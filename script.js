
// addEventListener version
window.addEventListener("online", (event) => {
  console.log("You are now connected to the network.");
});
window.addEventListener("offline", (event) => {
  console.log("You are now offline.");
});



// Drag and drop functions
const fileDropArea = document.getElementById("drag-area");
const fileDropInput = fileDropArea.querySelector("input#file-input");
fileDropInput.addEventListener("change", handleFiles);
fileDropArea.addEventListener("click", (() => { fileDropInput.click() }));

// Prevent default drag behaviours, and handle drag events
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, preventDefaults, false);
  window.addEventListener(eventName, deactivateDropZone, false);
  fileDropArea.addEventListener(eventName, preventDefaults, false);
  fileDropArea.addEventListener(eventName, activateDropZone, false)
});

// Handle dropped files
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function activateDropZone(e) {
  fileDropArea.classList.add("highlight");
  fileDropArea.addEventListener("drop", handleFiles, false);
  e.dataTransfer.dropEffect = 'copy';
};

function deactivateDropZone(e) {
  fileDropArea.classList.remove("highlight");
  fileDropArea.removeEventListener("drop", handleFiles, false);
  e.dataTransfer.dropEffect = 'none';
};

function handleFiles(e) {
  // get the files 
  let files;
  if (e.type == 'drop') {
    deactivateDropZone(e);
    files = e.dataTransfer.files;
  }
  if (e.type == 'change') {
    files = this.files;
  }

  files = [...files];

  files.forEach(async (file) => {
    const storedFileID = await model.storeFile(file);
    displayCard(storedFileID);
    processStoredFile(storedFileID);
  });
}
function displayCard(storedFileID) {
  // display a card for this file
  // if one doesn't exist, clone it.
  let metadata = model.getFile(storedFileID).metadata;

  let card = document.querySelector("#card-id-" + storedFileID);
  if (card === null) {
    let blankCard = document.querySelector(".card#file-card"); 
    card = blankCard.cloneNode(true);
    card.id = "card-id-" + storedFileID;
    blankCard.insertAdjacentElement('afterend', card);
  }

  card.classList.remove("hidden");
  card.querySelector(".file-name-text").textContent = metadata.fName;

  // File icons
  metadata.isPDF && card.querySelector(".file-name svg path#pdf").classList.remove("hidden");
  metadata.isZip && card.querySelector(".file-name svg path#zip").classList.remove("hidden");
  !metadata.isZip && !metadata.isPDF && card.querySelector(".file-name svg path#generic").classList.remove("hidden");

  (metadata.isEncryptedZip || metadata.isEncryptedPDF) ?
    card.querySelector(".file-name svg path#locked").classList.remove("hidden") :
    card.querySelector(".file-name svg path#unlocked").classList.remove("hidden");

  // Set up event listeners
  let inputGroup = card.querySelectorAll("div.input-group");
  inputGroup.forEach((group) => {
    let b = group.querySelector("button");
    let inp = group.querySelector("input");
    let action = b.textContent.toLowerCase();
    b.id = action + "_" + storedFileID;
    b.removeAttribute("onclick");
    inp.removeAttribute("onchange");
    inp.removeAttribute("onkeypress");
    b.addEventListener("click", () => { processStoredFile(storedFileID, "", [action]); });
    inp.addEventListener("keypress", (event) => { if (event.key === "Enter") { event.preventDefault(); b.click(); } });
  });
};

async function processStoredFile(storedFileID, inputPassword = "", actions = ['open', 'unprotect', 'protect']) {
  // console.log("processStoredFile: " + storedFileID);
  // let f = await model.getFile(storedFileID).obj;
  // let metadata.fName = f.name;
  let metadata = await model.getFile(storedFileID).metadata;

  // displayCard(storedFileID, metadata.fName);
  let card = document.querySelector("#card-id-" + storedFileID);
  inputPassword = (actions.includes('open')) ? card.querySelector("input#decrypt-input").value.trim() : "";

  if (metadata.isEncryptedZip || metadata.isEncryptedPDF) {
    card.querySelector(".decrypt-group").classList.remove("hidden");
  }

  if (metadata.isPDF) {
    // card.querySelector(".file-name svg path#pdf").classList.remove("hidden");
    if (!metadata.isEncryptedPDF && actions.includes('protect')) {
      // password-protect it immediately
      let pw = generatePassword();
      const encryptedPDFID = await cryptPDF(storedFileID, "", pw, false);
      // let card = document.querySelector("#card-id-" + storedFileID);
      card.querySelector(".file-name-subtext").textContent = "PDF with no password" + (metadata.isProtectedPDF ? ", but with some restrictions." : " and no restrictions.");
      // card.querySelector(".encrypt-group .status-message").textContent = "Password for this PDF file: " + pw;
      displayFileOnCard(storedFileID, encryptedPDFID, "PASSWORD-PROTECTED " + metadata.fName, ".encrypt-group", "Protected with password: " + pw);
      // await displayFile(encryptedPDFID, "PASSWORD-PROTECTED " + fName, "Password for this PDF file: " + pw);
    };

    if (!metadata.isEncryptedPDF && metadata.isProtectedPDF && actions.includes('unprotect')) {
      const unprotectedPDFID = await cryptPDF(storedFileID, "", "", true);
      displayFileOnCard(storedFileID, unprotectedPDFID, "UNRESTRICTED " + metadata.fName, ".unprotect-pdf-group", "PDF restrictions removed from original file.");
      // await displayFile(unprotectedPDFID, "UNRESTRICTED " + fName, "Protections removed.");
    };

    if (actions.includes('stamp')) {
      // Stamp the file
      let stampText = card.querySelector("input#stamp-pdf-input").value;
      if (!stampText) stampText = card.querySelector("input#stamp-pdf-input").placeholder;
      const stampedPDFID = await markPDF(storedFileID, stampText, metadata.ranges, metadata.runs, true);
      displayFileOnCard(storedFileID, stampedPDFID, "STAMPED " + metadata.fName, ".stamp-pdf-group", "PDF stamped with " + stampText);
    };

    if (actions.includes('mark')) {
      // Mark the file
      let recipientText = card.querySelector("input#mark-pdf-input").value;
      let markText = protectiveMarkTop =
        "Document prepared for release" +
        (!recipientText ? "" : " to " + recipientText) +
        " on " +
        new Date().toLocaleString("en-GB", { day: "2-digit", year: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const markedPDFID = await markPDF(storedFileID, markText, metadata.ranges, metadata.runs);
      displayFileOnCard(storedFileID, markedPDFID, "MARKED " + metadata.fName, ".mark-pdf-group", "PDF " + (!recipientText ? "marked for release." : "personalised for " + recipientText));
    };

    if (metadata.isEncryptedPDF && actions.includes('open')) {
      card.querySelector(".decrypt-group").classList.remove("hidden");
      const decryptedPDFID = await cryptPDF(storedFileID, inputPassword, "", true);
      if (decryptedPDFID === null) {
        // didn't decrypt with pw
        card.querySelector(".file-name-subtext").textContent = "PDF file is password-protected. " + (inputPassword == "" ? "" : "Cannot decrypt with password: " + inputPassword);
      } else {
        // successfully decrypted
        displayFileOnCard(storedFileID, decryptedPDFID, "PASSWORD-REMOVED " + metadata.fName, ".decrypt-group", "PDF password (" + inputPassword + ") removed from original file.");
      };
    };

    if (!metadata.isEncryptedPDF && !metadata.isProtectedPDF) {
      // Offer the stamp and mark options
      card.querySelector(".stamp-pdf-group").classList.remove("hidden");
      card.querySelector(".mark-pdf-group").classList.remove("hidden");
    };
  };

  if (metadata.isZip) {
    // card.querySelector(".file-name svg path#zip").classList.remove("hidden");
    if (!metadata.isEncryptedZip && actions.includes('protect')) {
      let pw = generatePassword();
      const encryptedZipID = await cryptZip(storedFileID, true, true, pw);
      displayFileOnCard(storedFileID, encryptedZipID, "PASSWORD-PROTECTED " + metadata.fName, ".encrypt-group", "Protected with password: " + pw);
      card.querySelector(".file-name-subtext").textContent = "Zip file with no password.";
    };

    if (metadata.isEncryptedZip && actions.includes('open')) {
      let canDecryptZip = await (metadata.isZip && metadata.isEncryptedZip ? isZipDecryptable(storedFileID, inputPassword) : true);
      if (canDecryptZip) {
        // Decrypt immediately
        const decryptedZipID = await cryptZip(storedFileID, true, false, inputPassword);
        displayFileOnCard(storedFileID, decryptedZipID, "PASSWORD-REMOVED " + metadata.fName, ".decrypt-group", "Password (" + inputPassword + ") removed from Zip file.");
        card.querySelector(".file-name-subtext").textContent = "Zip file is password-protected.";

      } else {
        card.querySelector(".file-name-subtext").textContent = "Zip file is password-protected. " + (inputPassword == "" ? "" : "Cannot decrypt with password: " + inputPassword);
      };
    };
  };

  if (!metadata.isPDF && !metadata.isZip && actions.includes('protect')) {
    card.querySelector(".file-name svg path#generic").classList.remove("hidden");
    // ordinary file, chuck it into a zip
    let pw = generatePassword();
    const encryptedZipID = await cryptZip(storedFileID, false, true, pw);
    card.querySelector(".file-name-subtext").textContent = "Placing file into a password-protected Zip file.";
    displayFileOnCard(storedFileID, encryptedZipID, "PASSWORD-PROTECTED " + metadata.fName + ".zip", '.decrypt-group', "Password for this Zip file: " + pw);
    // await displayFile(encryptedZipID, "PASSWORD-PROTECTED " + fName + ".zip", "Password for this Zip file: " + pw);
  };
};



async function markPDF(storedFileID, markText, ranges, runs, stamp = false) {

  let permissions = [coherentpdf.noAnnot, coherentpdf.noAssemble, coherentpdf.noCopy, coherentpdf.noEdit, coherentpdf.noExtract, coherentpdf.noForms];
  let encryption = coherentpdf.aes256bitisotrue;
  let f = await model.getFile(storedFileID).obj;
  let pdfBuffer = new Uint8Array(await f.arrayBuffer());
  let pdf = coherentpdf.fromMemory(pdfBuffer, "");
  coherentpdf.setFast();
  coherentpdf.upright(pdf);

  let overlay_pdfs = [];

  for (const r of runs) {
    let width = r[0];
    let height = r[1];
    let pdfRange = r[2];

    // create a blank overlay pdf, same page size and num of pages
    let overlayPdf = coherentpdf.blankDocument(width, height, pdfRange.length);


    if (stamp) {
      // Create the array of positions for a stamp
      let stampPositions = [];
      stampPositions.push([width * 1 / 4, height * 1.5 / 6]);
      stampPositions.push([width * 1 / 4, height * 3.5 / 6]);
      stampPositions.push([width * 1 / 4, height * 5.5 / 6]);
      stampPositions.push([width * 3 / 4, height * 0.5 / 6]);
      stampPositions.push([width * 3 / 4, height * 2.5 / 6]);
      stampPositions.push([width * 3 / 4, height * 4.5 / 6]);

      // scale the font wrt to the page area - for A4, approx 25pt.
      let fontScaleText = coherentpdf.textWidth(coherentpdf.helveticaBold, "CONFIDENTIAL") / coherentpdf.textWidth(coherentpdf.helveticaBold, markText);
      let fontScalePage = Math.sqrt((width / 600) * (height / 850));

      let fontScale = fontScalePage * fontScaleText;

      for (const position of stampPositions) {
        coherentpdf.addText(false, overlayPdf, coherentpdf.all(overlayPdf),
          markText,
          coherentpdf.posCentre, position[0], position[1],
          1.0, 1,
          coherentpdf.helveticaBold, 25 * fontScale,
          0.137, 0.157, 0.188,
          false,
          false,
          false,
          0.75,
          coherentpdf.centreJustify,
          true, false,
          "",
          1.0,
          false);
      }
    } else {
      // If the page is narrow, we need to scale down the font to fit
      // Calculate against A4 portrait width
      // Don't get bigger if it's wider
      let fontScalePage = Math.min((width / 595), 1);

      let fontScaleText = coherentpdf.textWidth(coherentpdf.helveticaBold, "Document prepared for release to FIRSTNAME LASTNAME on 15 July 2025, 20:00") / coherentpdf.textWidth(coherentpdf.helveticaBold, markText);
      fontScaleText = Math.min(fontScaleText, 1);

      let fontScale = fontScalePage * fontScaleText;

      // Scale factor
      // we want about 15 pts each at the top and bottom for A4 portrait. 
      // scaled if the font has been scaled down
      let frame_height = 15 * fontScale
      let sc = 1 - (frame_height * 2 / height);

      // Scale the original pdf 
      coherentpdf.scaleContents(pdf, pdfRange, coherentpdf.posCentre, width / 2, height / 2, sc);

      // Scale the overlay pdf 
      coherentpdf.scaleContents(overlayPdf, coherentpdf.all(overlayPdf), coherentpdf.posCentre, width / 2, height / 2, sc);

      // Mark the overlay pdf
      coherentpdf.addText(false, overlayPdf, coherentpdf.all(overlayPdf),
        markText,
        coherentpdf.bottom, -frame_height / 2, 0.0,
        1.0, 1,
        coherentpdf.helveticaBold, 13.5 * fontScale,
        0.137, 0.157, 0.188,
        false,
        false,
        false,
        1.0,
        coherentpdf.centreJustify,
        true, false,
        "",
        1.0,
        false);

      coherentpdf.addText(false, overlayPdf, coherentpdf.all(overlayPdf),
        markText,
        coherentpdf.top, -frame_height / 2, 0.0,
        1.0, 1,
        coherentpdf.helveticaBold, 13.5 * fontScale,
        0.137, 0.157, 0.188,
        false,
        false,
        false,
        1.0,
        coherentpdf.centreJustify,
        true, false,
        "",
        1.0,
        false);

      // impose the overlay (to cretae a visible box)
      coherentpdf.impose(overlayPdf, 1.0, 1.0, false, false, false, false, false, 0.0, 0.0, 0.5)
    }
    // Preserve the overlay pdf for later merging
    overlay_pdfs.push(overlayPdf);
  }

  // if necessary, merge the overlay pdfs
  if (overlay_pdfs.length > 1) {
    var overlayPdf = coherentpdf.mergeSimple(overlay_pdfs);
    overlay_pdfs.forEach((p) => { coherentpdf.deletePdf(p) });
  } else {
    var overlayPdf = overlay_pdfs[0];
  }

  let markedPdf = coherentpdf.combinePages(overlayPdf, pdf);

  let pdfOut = coherentpdf.toMemoryEncrypted(markedPdf, encryption, permissions, generatePassword(), "", false, false);
  let pdfBlob = new Blob([pdfOut], { type: 'application/pdf' });
  coherentpdf.deletePdf(pdf);
  coherentpdf.deletePdf(overlayPdf);
  coherentpdf.deletePdf(markedPdf);
  return await model.storeFile(pdfBlob);
}

function generatePassword(minimumEntropy = 70) {
  // Pattern abcdef-234567-pqrtuv
  // Easy to type on a touchscreen keyboard
  // Easy to read out
  // No easily confused characters (losz)
  // Entropy, assuming you know the pattern: 71 bits,
  // (a lot better than correct-horse-battery-staple at 44 bits)

  let entropy_alpha = Math.log2(Math.pow(22, 6));
  let entropy_num = Math.log2(Math.pow(8, 6));
  let p = "";
  let pwEntropy = 0;
  let alpha = true;
  while (pwEntropy < minimumEntropy) {
    p += " " + (alpha ? pw(/[0-9]|[losz]/) : pw(/[01]|[a-z]/));
    pwEntropy += (alpha ? entropy_alpha : entropy_num);
    alpha = !alpha;
  };
  return p.trim().replace(/ /g, "-");

  function pw(bannedRegEx) {
    let p = "";
    let re = new RegExp(bannedRegEx, 'g');
    while (p.length < 6) {
      // pw_alpha += Math.random().toString(36).slice(2, 7);
      p += crypto.getRandomValues(new BigUint64Array(5)).reduce((a, b) => { return a + b.toString(36) }, "");
      p = p.replace(re, '');
    }
    return p.slice(0, 6);
  };

}

function formatFileName(fN, max = 40) {
  if (max < 11) { max = 11 };
  if (fN.length < max) {
    return fN;
  } else {
    let extensionDelimiterIndex = fN.lastIndexOf('.');
    let middleRemovedName = `${fN.substring(0, max - 10)}...${fN.substring(extensionDelimiterIndex - 3)}`
    return middleRemovedName;
  }
}




async function isZipDecryptable(storedFileID, password) {
  const entries = await model.getEntriesFromStoredFile(storedFileID);

  for (e in entries) {
    if (entries[e].encrypted) {
      // if any entry fails, we can't decrypt
      try {
        await model.getEntryContent(entries[e], { password: password, checkPasswordOnly: true });
      } catch (e) {
        return false;
      }
    }
  }
  // if we got here with no errors
  return true;
}

async function cryptZip(storedFileID, isZip, encrypt = true, password, options = {}) {
  const fName = await model.getFile(storedFileID)
  const newZipFileID = await model.createEmptyZip();
  let passwordOptions = Object.assign({ ...options }, { password: password });
  const writingOptions = encrypt ? passwordOptions : options;
  const readingOptions = encrypt ? options : passwordOptions;
  let dirOptions = Object.assign({ ...options }, { directory: true });

  if (isZip) {
    const entries = await model.getEntriesFromStoredFile(storedFileID, options);
    for (e in entries) {
      await transferEntry(entries[e]);
    };
  } else {
    // if it's just a plain old file
    let blob = model.getFile(storedFileID).obj
    let f = new File([blob], blob.name);
    await model.addFileToZip(f, newZipFileID, writingOptions);
  }
  await model.closeZip(newZipFileID);
  return newZipFileID;

  async function transferEntry(e) {
    if (!e.directory) {
      let entryBlob = await model.getEntryContent(e, readingOptions);
      let f = new File([entryBlob], e.filename);
      return model.addFileToZip(f, newZipFileID, writingOptions);
    } else {
      return model.addDirToZip(e.filename, newZipFileID, dirOptions)
    };
  };
}

async function cryptPDF(storedFileID, decryption_pw = "", encryption_pw = "", unProtect = false) {
  // will try to decrypt first
  // then encrypt 
  // will always try to set owner permissions with a random password.
  console.log("in cryptPDF");
  let permissions = [coherentpdf.noAnnot, coherentpdf.noAssemble, coherentpdf.noCopy, coherentpdf.noEdit, coherentpdf.noExtract, coherentpdf.noForms];
  let encryption = coherentpdf.aes256bitisotrue;
  let f = await model.getFile(storedFileID).obj;
  let pdfBuffer = new Uint8Array(await f.arrayBuffer());
  let pdf = coherentpdf.fromMemory(pdfBuffer, "");
  coherentpdf.setFast();
  let decryptionSuccess;
  try {
    coherentpdf.decryptPdf(pdf, decryption_pw);
    decryptionSuccess = true;
  } catch (error) {
    decryptionSuccess = false;
  };
  if (!decryptionSuccess) {
    try {
      coherentpdf.decryptPdf(pdf, "");
      decryptionSuccess = true;
    } catch (error) {
      decryptionSuccess = false;
    }
  }
  if (!decryptionSuccess) return null;

  if (unProtect) {
    var pdfOut = coherentpdf.toMemory(pdf, false, false);
  } else {
    var pdfOut = coherentpdf.toMemoryEncrypted(pdf, encryption, permissions, generatePassword(), encryption_pw, false, false);
  }
  pdfBlob = new Blob([pdfOut], { type: 'application/octet-stream' });
  coherentpdf.deletePdf(pdf);
  return await model.storeFile(pdfBlob);

}

async function displayFileOnCard(storedFileID_original, storedFileID_new, downloadFileName, cardGroup, displayText, buttonText) {
  let card = document.querySelector("#card-id-" + storedFileID_original);
  let group = card.querySelector(cardGroup);
  let message = group.querySelector("span.status-message");
  let input = group.querySelector("input");
  let button = group.querySelector("button");
  let a = group.querySelector("a");

  input.classList.add("hidden");

  button.classList.add("hidden");

  message.textContent = displayText;
  message.classList.remove("hidden");

  a.textContent = "Save";
  a.href = URL.createObjectURL(await model.getFile(storedFileID_new).obj);
  a.download = downloadFileName;
  a.classList.remove("hidden");

  group.classList.remove("hidden");
}

const model = (() => {
  // let zipWriter;
  let fileStore = new Map();

  return {
    async storeFile(file) {
      // let blob = await file.arrayBuffer();
      let newFileID = 1 + fileStore.keys().reduce((a, b) => { return a > b ? a : b }, 0);
      fileStore.set(newFileID, { obj: file, type: 'file' });
      let metadata = await model.analyseFile(newFileID);
      fileStore.set(newFileID, { obj: file, type: 'file', metadata });
      return newFileID;
    },

    async analyseFile(fileID) {

      let metadata = Object.create(null);


      let f = model.getFile(fileID).obj;
      metadata.isZip = (f.type == 'application/zip' || f.type == 'application/x-zip-compressed');
      metadata.isPDF = (f.type == 'application/pdf');
      metadata.fName = f.name;


      if (metadata.isPDF) {
        // check if it's a valid PDF
        var pdfBuffer = new Uint8Array(await f.arrayBuffer());
        try {
          // if this succeeds, it's a PDF
          var pdf = coherentpdf.fromMemory(pdfBuffer, "");

        } catch {
          metadata.isPDF = false;
        }
      };

      if (metadata.isPDF) {
        // check if it's password-protected
        // if it only has an owner-password, strip that out
        let orig_encrypted = (coherentpdf.isEncrypted(pdf));
        metadata.isEncryptedPDF = false;
        metadata.isProtectedPDF = false;
        // var canDecryptPDF;
        if (orig_encrypted) {
          try {
            coherentpdf.decryptPdf(pdf, "");
            metadata.isProtectedPDF = true;
            metadata.canDecryptPDF = true;
            console.log("Owner protection can be removed");
          } catch {
            metadata.isEncryptedPDF = true;
            metadata.canDecryptPDF = false;
          }
        }

        // Analyse the ranges and runs
        // only if not encrypted and not protected

        if (!metadata.isEncryptedPDF && !metadata.isProtectedPDF) {

          var ranges = new Map();
          var runs = [];
          let prev_sizespec = "";
          let prev_width, prev_height = 0;
          let curr_run = [];
          for (let pg = 1; pg <= coherentpdf.pages(pdf); pg++) {
            let mb = coherentpdf.getMediaBox(pdf, pg);
            let width = mb[1] - mb[0];
            let height = mb[3] - mb[2];
            let sizespec = width.toString() + "x" + height.toString();
            if (ranges.has(sizespec)) {
              let arr = ranges.get(sizespec);
              arr[1].push(pg);
              ranges.set(sizespec, arr);
            } else {
              ranges.set(sizespec, [mb, [pg]]);
            };


            if (prev_sizespec == sizespec || pg == 1) {
              curr_run.push(pg);

            } else {
              runs.push([prev_width, prev_height, curr_run]);
              curr_run = [pg];
            }
            prev_sizespec = sizespec;
            prev_width = width;
            prev_height = height;
          };
          runs.push([prev_width, prev_height, curr_run]);

          // console.log("Ranges and runs defined", ranges, runs);
          coherentpdf.deletePdf(pdf);
        }
        metadata.runs = runs;
        metadata.ranges = ranges;
      };

      if (metadata.isZip) {
        // only check if it's the right mime-type
        // Because Office files will pass testZip()
        // but they can't be encrypted like normal zip files.
        let zipTest = await model.testZip(fileID);
        metadata.isZip = zipTest.valid;
        metadata.isEncryptedZip = zipTest.encrypted;
      };

      return metadata;
    },

    getFile(fileID) {
      // let blob = await file.arrayBuffer();
      return fileStore.get(fileID);
    },

    async getEntriesFromStoredFile(zipFileID, options) {
      try {
        return await (new zip.ZipReader(new zip.BlobReader(fileStore.get(zipFileID).obj))).getEntries(options);
      } catch {
        return null;
      }
    },

    async getEntryContent(entry, options) {
      return await entry.getData(new zip.BlobWriter(), options);
    },

    async testZip(storedFileID) {
      const entries = await model.getEntriesFromStoredFile(storedFileID);
      if (entries === null) { return ({ valid: false, encrypted: null }) } else {
        return ({ valid: true, encrypted: entries.some((e) => !e.directory && e.encrypted) });
      }
    },

    async createEmptyZip(options) {
      let newFileID = 1 + fileStore.keys().reduce((a, b) => { return a > b ? a : b }, 1);
      let zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { bufferedWrite: true });
      fileStore.set(newFileID, { obj: zipWriter, type: 'zipWriter' });
      return newFileID;
    },

    async addFileToZip(file, zipFileID, options = {}) {
      let zipWriter = fileStore.get(zipFileID).obj;
      // let file = fileStore.get(FileID).obj;
      return await zipWriter.add(file.name, new zip.BlobReader(file), options);
    },

    async addDirToZip(dirName, zipFileID, options = {}) {
      let zipWriter = fileStore.get(zipFileID).obj;
      // let file = fileStore.get(FileID).obj;
      return await zipWriter.add(dirName, new zip.TextReader(""), options);
    },

    async closeZip(zipFileID) {
      let f = fileStore.get(zipFileID)
      let zipWriter = f.obj;
      return fileStore.set(zipFileID, { obj: await zipWriter.close(), type: 'blob' });
      // return await fileStore.set(zipFileID, { obj: await zipWriter.close(), type: 'file' }).has(zipFileID) ? zipFileID : 0
    },
  };

})();



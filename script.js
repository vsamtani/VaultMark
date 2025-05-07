// VaultMark
// Copyright (C) 2025 Vijay Samtani
// Acknowledgements:
// - John Whitington: https://github.com/coherentgraphics/coherentpdf.js
// - Gildas Lormeau: https://github.com/gildas-lormeau/zip.js

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Drag and drop functions


const fileDropArea = document.getElementById("drag-area");

const fileDropInput = document.querySelector("input#file-input");
fileDropInput.addEventListener("change", handleSelectedFiles);

const fileSelectButton = document.querySelector("header button.file-select-button");
fileSelectButton.addEventListener("click", (() => { fileDropInput.click() }));

// Prevent default drag behaviours, and handle drag events

for (eventName of ["dragenter", "dragover", "dragleave", "drop"]) {
  window.addEventListener(eventName, preventDefaults, false);
  window.addEventListener(eventName, deactivateDropZone, false);
  fileDropArea.addEventListener(eventName, preventDefaults, false);
};

fileDropArea.addEventListener("dragenter", activateDropZone, false);
fileDropArea.addEventListener("dragover", activateDropZone, false);
fileDropArea.addEventListener("dragleave", deactivateDropZone, false);
fileDropArea.addEventListener("drop", handleDroppedFiles, false);

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function activateDropZone(e) {
  let items = [...e.dataTransfer.items];
  if (items.some((i) => i.type !== '')) {
    fileDropArea.classList.add("highlight");
    // fileDropArea.addEventListener("drop", handleDroppedFiles, false);
    e.dataTransfer.dropEffect = 'copy';
  }
}

function deactivateDropZone(e) {
  fileDropArea.classList.remove("highlight");
  // fileDropArea.removeEventListener("drop", handleDroppedFiles, false);
  e.dataTransfer.dropEffect = 'none';
};

function handleDroppedFiles(e) {
  deactivateDropZone(e);
  handleFiles([ ...e.dataTransfer.files]);
}

function handleSelectedFiles(e) {
  handleFiles([ ...this.files ]);
}

function handleFiles(files) {
  let handledFiles = [];

  // files.filter((f) => f.size > 0 || f.type !== '').forEach 
  files.forEach(async (file) => {
    if (file.size > 0 || file.type !== '') {
      const storedFileID = await model.storeFile(file);
      displayCard(storedFileID, model.getFileMetadata(storedFileID));
      processStoredFile(storedFileID, "", ['open', 'protect', 'unprotect']);
      handledFiles.push(storedFileID);
    }
  });
}


async function displayCard(storedFileID, metadata) {
  // display a card for this file
  // if one doesn't exist, clone it.
  document.getElementById("introContent").classList.add("hidden");
  // let metadata = model.getFileMetadata(storedFileID);

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

  // File subtext 
  let subText =
    (metadata.isPDF ?
      (metadata.isEncryptedPDF ?
        "PDF locked with a password" :
        (metadata.isProtectedPDF ?
          "PDF with no password and some restrictions" :
          "PDF with no password and no restrictions"
        )
      ) :
      metadata.isZip ?
        (metadata.isEncryptedZip ?
          (metadata.zipFileCount == 1 ?
            "Single file in a locked Zip file" :
            "Zip file locked with a password"
          ) :
          "Zip file with no password"
        ) :
        "Ordinary file, to be locked in a Zip file"
    )
  card.querySelector(".file-name-subtext").innerHTML = subText;

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
    let click_handler = (e) => { processStoredFile(storedFileID, "", [action]); }
    b.addEventListener("click", click_handler);
    inp.addEventListener("keypress", (event) => { if (event.key === "Enter") { event.preventDefault(); b.click(); } });
  });

  // Add a drag and drop listener because we've covered some of the drop zone
  card.addEventListener("dragover", activateDropZone, false);
};

async function displayFileOnCard(cardID, objectURL, downloadFileName, cardGroup, displayText, buttonText) {
  let card = document.querySelector("#card-id-" + cardID);
  let group = card.querySelector(cardGroup);
  let message = group.querySelector("span.status-message");
  let input = group.querySelector("input");
  let button = group.querySelector("button");
  let a = group.querySelector("a");

  input.classList.add("hidden");

  button.classList.add("hidden");

  message.innerHTML = displayText;
  message.classList.remove("hidden");

  a.innerHTML = "Save";
  a.href = objectURL;
  a.download = downloadFileName;
  a.classList.add("save-button");
  a.classList.remove("hidden");


  group.classList.remove("hidden");
}

async function processStoredFile(storedFileID, inputPassword = "", actions = ['open', 'unprotect', 'protect']) {
  // this function is basically the controller.
  let metadata = await model.getFileMetadata(storedFileID);

  let card = document.querySelector("#card-id-" + storedFileID);
  let passwordField = card.querySelector("input#decrypt-input");
  inputPassword = (actions.includes('open')) ? passwordField.value.trim() : "";

  if (metadata.isEncryptedZip || metadata.isEncryptedPDF) {
    // view updates
    card.querySelector(".decrypt-group").classList.remove("hidden");
  }

  if (metadata.isPDF) {
    if (!metadata.isEncryptedPDF && actions.includes('protect')) {
      let pw = generatePassword();
      const encryptedPDFID = await model.cryptPDF(storedFileID, "", pw, false);
      metadata = model.getFileMetadata(storedFileID);

      // view updates
      displayFileOnCard(storedFileID, model.getFileMetadata(encryptedPDFID).URL, model.getFileMetadata(encryptedPDFID).fName, ".encrypt-group", `Locked with password: <br><strong>${pw}</strong>`);
    };

    if (!metadata.isEncryptedPDF && metadata.isProtectedPDF && actions.includes('unprotect')) {
      const unprotectedPDFID = await model.cryptPDF(storedFileID, "", "", true);
      metadata = await model.getFileMetadata(storedFileID);

      // view updates
      displayFileOnCard(storedFileID, model.getFileMetadata(unprotectedPDFID).URL, model.getFileMetadata(unprotectedPDFID).fName, ".unprotect-pdf-group", "PDF restrictions removed.");;

    };

    if (actions.includes('stamp')) {
      let stampText = card.querySelector("input#stamp-pdf-input").value;
      if (!stampText) stampText = card.querySelector("input#stamp-pdf-input").placeholder;
      const stampedPDFID = await model.markPDF(storedFileID, stampText, metadata.ranges, metadata.runs, true);

      // view updates
      displayFileOnCard(storedFileID, model.getFileMetadata(stampedPDFID).URL, model.getFileMetadata(stampedPDFID).fName, ".stamp-pdf-group", `Stamped with: <strong>${stampText}</strong>`);
    };

    if (actions.includes('mark')) {
      let recipientText = card.querySelector("input#mark-pdf-input").value;
      let markText = protectiveMarkTop =
        "Document prepared for release" +
        (!recipientText ? "" : " to " + recipientText) +
        " on " +
        new Date().toLocaleString("en-GB", { day: "2-digit", year: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const markedPDFID = await model.markPDF(storedFileID, markText, metadata.ranges, metadata.runs);

      // view updates
      displayFileOnCard(storedFileID, model.getFileMetadata(markedPDFID).URL, model.getFileMetadata(markedPDFID).fName, ".mark-pdf-group", `Marked for release${(recipientText ? ` to <strong>${recipientText}</strong>` : `.`)}`);
    };

    if (metadata.isEncryptedPDF && actions.includes('open')) {
      const decryptedPDFID = await model.cryptPDF(storedFileID, inputPassword, "", false);
      if (decryptedPDFID === null) {
        // didn't decrypt with pw
        passwordField.value = "";
        if (inputPassword !== '') passwordField.placeholder = "Could not open with '" + inputPassword + "'";
      } else {
        metadata = await model.getFileMetadata(storedFileID);
        console.log("metadata:", metadata);

        // view updates
        displayFileOnCard(storedFileID, model.getFileMetadata(decryptedPDFID).URL, model.getFileMetadata(decryptedPDFID).fName, ".decrypt-group", "Password removed");
      };
    };
    console.log("Checking metadata");
    if (!metadata.isEncryptedPDF && !metadata.isProtectedPDF) {
      // Offer the stamp and mark options
      card.querySelector(".stamp-pdf-group").classList.remove("hidden");
      card.querySelector(".mark-pdf-group").classList.remove("hidden");
    };
  };

  if (metadata.isZip) {
    if (!metadata.isEncryptedZip && actions.includes('protect')) {
      let pw = generatePassword();
      const encryptedZipID = await model.cryptZip(storedFileID, true, true, pw);


      displayFileOnCard(storedFileID, model.getFileMetadata(encryptedZipID).URL, model.getFileMetadata(encryptedZipID).fName, ".encrypt-group", `Locked with password: <br><strong>${pw}</strong>`);
    };

    if (metadata.isEncryptedZip && actions.includes('open')) {
      let canDecryptZip = await (metadata.isZip && model.isZipDecryptable(storedFileID, inputPassword));
      if (!canDecryptZip) {
        // can't decrypt
        passwordField.value = "";
        if (inputPassword !== '') passwordField.placeholder = "Could not open with '" + inputPassword + "'";
      } else {
        const decryptedZipID = await model.cryptZip(storedFileID, true, false, inputPassword);
        displayFileOnCard(storedFileID, model.getFileMetadata(decryptedZipID).URL, model.getFileMetadata(decryptedZipID).fName, ".decrypt-group", "Password removed");
      }
    };
  };

  if (!metadata.isPDF && !metadata.isZip && actions.includes('protect')) {
    // ordinary file, chuck it into a zip
    let pw = generatePassword();
    const encryptedZipID = await model.cryptZip(storedFileID, false, true, pw);
    displayFileOnCard(storedFileID, model.getFileMetadata(encryptedZipID).URL, model.getFileMetadata(encryptedZipID).fName, '.encrypt-group', `Locked with password: <br><strong>${pw}</strong>`);
  };

  // card.querySelector(".file-name-subtext").innerHTML = subText;
  // if (typeof unprotectedPDFID !== 'undefined') {    
  //   await model.storeFile(await model.getFile(unprotectedPDFID).obj, storedFileID);
  //   processStoredFile(storedFileID, "", []);
  // }

};


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


const model = (() => {
  // let zipWriter;
  const fileStore = new Map();
  const eventListeners = new Map();

  function addEventListener(eventName, listener) {
    if (!eventListeners.has(eventName)) {
      eventListeners.set(eventName, new Set());
    }
    eventListeners.get(eventName).add(listener);
  }

  function removeEventListener(eventName, listener) {
    if (eventListeners.has(eventName)) {
      eventListeners.get(eventName).delete(listener);
    }
  }

  function fireEvent(eventName, eventData) {
    console.log("Event: ", eventName, "Data: ", eventData);
    if (eventListeners.has(eventName)) {
      for (const callback of eventListeners.get(eventName)) {
        callback(eventData);
      }
    }
  }

  async function storeFile(file, targetFileID = 0) {
    let insert = false;
    if (targetFileID == 0) {
      insert = true;
      targetFileID = 1 + fileStore.keys().reduce((a, b) => { return a > b ? a : b }, 0);
    }
    fileStore.set(targetFileID, { obj: file, type: 'file' });
    let metadata = await analyseFile(targetFileID);
    fileStore.set(targetFileID, { obj: file, type: 'file', metadata });
    insert ? fireEvent('insert', targetFileID) : fireEvent('update', targetFileID);
    return targetFileID;
  }

  function getFile(fileID) {
    return fileStore.get(fileID);
    // return structuredClone(fileStore.get(fileID));
  }

  function getFileMetadata(fileID) {
    return Object.freeze(structuredClone(fileStore.get(fileID).metadata));
  }
  // function setFileName(fileID, fName) {
  //   fileStore.get(fileID).metadata.fName = fName;
  // }

  async function analyseFile(fileID) {

    let metadata = Object.create(null);

    let f = fileStore.get(fileID).obj;
    metadata.URL = URL.createObjectURL(f);
    metadata.isZip = (f.type == 'application/zip' || f.type == 'application/x-zip-compressed');
    metadata.isPDF = (f.type == 'application/pdf');

    if (f.type == '') {
      // try to guess from extension
      let ext = f.name.split('.');
      (ext.length > 1) ? ext = ext.pop().toLowerCase() : ext = "";
      metadata.isZip = (ext == 'zip');
      metadata.isPDF = (ext == 'pdf');
    }

    metadata.fName = f.name;


    if (metadata.isPDF) {
      // check if it's a valid PDF
      var pdfBuffer = new Uint8Array(await f.arrayBuffer());
      try {
        // if this succeeds, it's a PDF
        var pdf = coherentpdf.fromMemory(pdfBuffer, "");
      } catch (e) {
        if (e[2].c.search(/password/, "i") >= 0) {

          // it's a pdf, but we can't load it into memory to analyse it
          metadata.isPDF = true;
          metadata.isEncryptedPDF = true;
          return metadata;
        } else {
          metadata.isPDF = false;
          metadata.isEncryptedPDF = false;
          return metadata;
        }
      }
    };

    if (metadata.isPDF) {
      // check if it's password-protected
      // if it only has an owner-password, we can strip that out
      let orig_encrypted = (coherentpdf.isEncrypted(pdf));
      metadata.isEncryptedPDF = false;
      metadata.isProtectedPDF = false;
      // var canDecryptPDF;
      if (orig_encrypted) {
        try {
          coherentpdf.decryptPdf(pdf, "");
          metadata.isProtectedPDF = true;
          metadata.canDecryptPDF = true;
          // console.log("Owner protection can be removed");
        } catch (e) {
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
        metadata.runs = runs;
        metadata.ranges = ranges;
      }

    };

    if (metadata.isZip) {
      // only check if it's the right mime-type
      // Because Office files will pass testZip()
      // but they can't be encrypted like normal zip files.
      let zipTest = await testZip(fileID);
      metadata.isZip = zipTest.valid;
      metadata.isEncryptedZip = zipTest.encrypted;
      metadata.zipFileCount = zipTest.files;
    };

    return metadata;
  }



  async function getEntriesFromStoredFile(zipFileID, options) {
    try {
      return await (new zip.ZipReader(new zip.BlobReader(fileStore.get(zipFileID).obj))).getEntries(options);
    } catch {
      return null;
    }
  }

  async function getEntryContent(entry, options) {
    return await entry.getData(new zip.BlobWriter(), options);
  }

  async function testZip(storedFileID) {
    const entries = await getEntriesFromStoredFile(storedFileID);
    if (entries === null) { return ({ valid: false, encrypted: null, files: null }) } else {
      // entries.filter((e) => !e.directory).length
      return ({
        valid: true,
        encrypted: entries.some((e) => !e.directory && e.encrypted),
        files: entries.filter((e) => !e.directory).length
      });
    }
  }

  async function createEmptyZip(options) {
    let newFileID = 1 + fileStore.keys().reduce((a, b) => { return a > b ? a : b }, 1);
    let zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { bufferedWrite: true });
    fileStore.set(newFileID, { obj: zipWriter, type: 'zipWriter' });
    return newFileID;
  }

  async function addFileToZip(file, zipFileID, options = {}) {
    let zipWriter = fileStore.get(zipFileID).obj;
    return await zipWriter.add(file.name, new zip.BlobReader(file), options);
  }

  async function addDirToZip(dirName, zipFileID, options = {}) {
    let zipWriter = fileStore.get(zipFileID).obj;
    return await zipWriter.add(dirName, new zip.TextReader(""), options);
  }

  async function closeZip(zipFileID, fileName) {
    let f = fileStore.get(zipFileID)
    let zipWriter = f.obj;
    return await storeFile(new File([await zipWriter.close()], fileName));
    // return fileStore.set(zipFileID, { obj: await zipWriter.close(), type: 'blob' });
    // return await fileStore.set(zipFileID, { obj: await zipWriter.close(), type: 'file' }).has(zipFileID) ? zipFileID : 0
  }

  async function cryptZip(storedFileID, isZip, encrypt = true, password, options = {}) {

    // Here's what the function should do
    // if storedFileID is an encrypted Zip, decrypt it
    // decrypt it to a zip if it has >1 file
    // decrypt it to a file if it has 1 file
    // if storedFileID is an unencrypted Zip, encrypt it, and then offer to double lock it
    // if storedFileID is not a zip, put it in an encrypted zip


    // const fName = await model.getFile(storedFileID);
    // const newFileID = await model.createEmptyZip();
    let passwordOptions = Object.assign({ ...options }, { password: password });
    const writingOptions = encrypt ? passwordOptions : options;
    const readingOptions = encrypt ? options : passwordOptions;
    let dirOptions = Object.assign({ ...options }, { directory: true });

    let metadata = getFile(storedFileID).metadata;

    if (metadata.isZip && !(metadata.isEncryptedZip && metadata.zipFileCount == 1)) {
      const entries = await getEntriesFromStoredFile(storedFileID, options);
      var newFileID = await createEmptyZip();
      for (e in entries) {
        await transferEntry(entries[e]);
        fireEvent('zip-progress', { input: storedFileID, current: e, total: entries.length});
      };
      newFileID = await closeZip(newFileID, (encrypt ? "PASSWORD-PROTECTED " : "PASSWORD-REMOVED ") + metadata.fName);
      encrypt
        ? fireEvent('zip-encrypt', { input: storedFileID, output: newFileID, operation: 'zip-encrypt' })
        : fireEvent('zip-decrypt', { input: storedFileID, output: newFileID, operation: 'zip-decrypt' });

      return newFileID;
      // getFile(newFileID).metadata.fName = (encrypt ? "PASSWORD-PROTECTED " : "PASSWORD-REMOVED ") + metadata.fName;
      // if we've just encrypted a multi-file zip, we could now put that into an outer zip
      // let new_metadata = model.getFile(newFileID).metadata;
      // if (encrypt && new_metadata.zipFileCount > 1) { var doubleLockedZip = await cryptZip}
      // if we've just decrypted a zip and what's inside is a single-file zip, we could unzip that too
    }

    if (metadata.isZip && metadata.isEncryptedZip && metadata.zipFileCount == 1) {
      // extracting just one file
      const entries = await getEntriesFromStoredFile(storedFileID, options);
      let e = entries.filter((e) => !e.directory)[0];
      fireEvent('zip-progress', { input: storedFileID, current: 1, total: 1});
      var newFileID = await extractEntryToFile(e);
      fireEvent('zip-decrypt', { input: storedFileID, output: newFileID, operation: 'zip-decrypt', message: '' })
      //  We can check at this point if the file 
      // we've just extracted is another zip file, is also encrypted, etc.
    }

    if (!metadata.isZip) {
      // if it's just a plain old file
      let blob = getFile(storedFileID).obj
      let f = new File([blob], blob.name);
      var newFileID = await createEmptyZip();
      fireEvent('zip-progress', { input: storedFileID, current: 1, total: 1});
      await addFileToZip(f, newFileID, writingOptions);
      newFileID = await closeZip(newFileID, "PASSWORD-PROTECTED " + metadata.fName + ".zip");
      // getFile(newFileID).metadata.fName = "PASSWORD-PROTECTED " + metadata.fName + ".zip";
      fireEvent('zip-encrypt', { input: storedFileID, output: newFileID, operation: 'zip-encrypt' })
    }

    return newFileID;

    async function extractEntryToFile(e) {
      let entryBlob = await getEntryContent(e, readingOptions);
      let f = new File([entryBlob], e.filename);
      let newFileID = await storeFile(f);
      // fileStore.get(newFileID).metadata.fName = e.filename;
      return newFileID;
    }

    async function transferEntry(e) {
      if (!e.directory) {
        let entryBlob = await getEntryContent(e, readingOptions);
        let f = new File([entryBlob], e.filename);
        return addFileToZip(f, newFileID, writingOptions);
      } else {
        return addDirToZip(e.filename, newFileID, dirOptions)
      };
    };
  }

  async function isZipDecryptable(storedFileID, password) {
    const entries = await getEntriesFromStoredFile(storedFileID);

    for (e in entries) {
      if (entries[e].encrypted) {
        // if any entry fails, we can't decrypt
        try {
          await getEntryContent(entries[e], { password: password, checkPasswordOnly: true });
        } catch (e) {
          return false;
        }
      }
    }
    // if we got here with no errors
    return true;
  }

  async function cryptPDF(storedFileID, decryption_pw = "", encryption_pw = "", unProtect = false) {
    // will try to decrypt first
    // then encrypt 
    // will always try to set owner permissions with a random password.

    let permissions = [coherentpdf.noAnnot, coherentpdf.noAssemble, coherentpdf.noCopy, coherentpdf.noEdit, coherentpdf.noExtract, coherentpdf.noForms];
    let encryption = coherentpdf.aes256bitisotrue;
    let f = await getFile(storedFileID).obj;
    let pdfBuffer = new Uint8Array(await f.arrayBuffer());
    let pdf;
    let loadSuccess = false;

    try {
      pdf = coherentpdf.fromMemory(pdfBuffer, "");
      loadSuccess = true;
    } catch (e) { }

    if (!loadSuccess) {
      try {
        pdf = coherentpdf.fromMemory(pdfBuffer, decryption_pw);
        loadSuccess = true;
      } catch (e) { }
    }

    coherentpdf.setFast();

    let decryptionSuccess = false;
    if (loadSuccess) {
      try {
        // supplied user password
        coherentpdf.decryptPdf(pdf, decryption_pw);
        decryptionSuccess = true;
      } catch (e) {
      };
      if (!decryptionSuccess) {
        try {
          // blank user password
          coherentpdf.decryptPdf(pdf, "");
          decryptionSuccess = true;
        } catch (e) {
        }
      };
      if (!decryptionSuccess) {
        try {
          // supplied password as owner password
          coherentpdf.decryptPdfOwner(pdf, decryption_pw);
          decryptionSuccess = true;
        } catch (e) {
        }
      };
    }

    if (!decryptionSuccess) return null;


    // pdfBlob = new Blob([pdfOut], { type: 'application/pdf' });
    // coherentpdf.deletePdf(pdf);


    if (unProtect) {
      var pdfOut = coherentpdf.toMemory(pdf, false, false);

      var pdfBlob = new Blob([pdfOut], { type: 'application/pdf' });
      var newFileName = "UNRESTRICTED " + fileStore.get(storedFileID).metadata.fName;
      var event = 'pdf-unprotect';
      // update the input file 
      await storeFile(new File([pdfBlob], fileStore.get(storedFileID).metadata.fName), storedFileID);
    } else {
      var pdfOut = coherentpdf.toMemoryEncrypted(pdf, encryption, permissions, generatePassword(), encryption_pw, false, false);
      var pdfBlob = new Blob([pdfOut], { type: 'application/pdf' });
      if (encryption_pw == '') {
        var newFileName = "PASSWORD-REMOVED " + fileStore.get(storedFileID).metadata.fName;
        var event = 'pdf-decrypt';
        // // update the input file
        // await storeFile(new File([pdfBlob], fileStore.get(storedFileID).metadata.fName), storedFileID);
      } else {
        var newFileName = "PASSWORD-PROTECTED " + fileStore.get(storedFileID).metadata.fName;
        var event = 'pdf-encrypt';
      }
    }
    let newFileID = await storeFile(new File([pdfBlob], newFileName));
    // setFileName(newFileID, newFileName);
    fireEvent(event, { input: storedFileID, output: newFileID });
    return newFileID;

  }

  async function markPDF(storedFileID, markText, ranges, runs, stamp = false) {

    let permissions = [coherentpdf.noAnnot, coherentpdf.noAssemble, coherentpdf.noCopy, coherentpdf.noEdit, coherentpdf.noExtract, coherentpdf.noForms];
    let encryption = coherentpdf.aes256bitisotrue;
    let f = await getFile(storedFileID).obj;
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

    let newFileName = (stamp ? "STAMPED " : "MARKED ") + fileStore.get(storedFileID).metadata.fName;

    let newFileID = await storeFile(new File([pdfBlob], newFileName));
    // setFileName(newFileID, newFileName);
    fireEvent((stamp ? 'pdf-stamp' : 'pdf-mark'), { input: storedFileID, output: newFileID });
    return newFileID;
  }


  return {
    storeFile,
    getFile,
    getFileMetadata,
    // setFileName,
    // getEntriesFromStoredFile,
    // getEntryContent,
    // createEmptyZip,
    // addFileToZip,
    // addDirToZip,
    isZipDecryptable,
    // closeZip,
    cryptZip,
    cryptPDF,
    markPDF
  };

})();



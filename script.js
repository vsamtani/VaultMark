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




// IIFE, acting as a wrapper on the file storage and processing
const model = (() => {

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

  async function storeFile(file, initialMetadata = {}, targetFileID = 0) {
    let insert = false;
    if (targetFileID == 0) {
      insert = true;
      targetFileID = 1 + fileStore.keys().reduce((a, b) => { return a > b ? a : b }, 0);
    }
    fileStore.set(targetFileID, { obj: file, type: 'file', metadata: initialMetadata });
    let metadata = await analyseFile(targetFileID);
    // Update the parent file if this is a child.
    if (metadata.parentFile !== 0) {
      fileStore.get(metadata.parentFile).metadata.children.set(metadata.parentAction, targetFileID);
    }

    fireEvent((insert ? 'insert' : 'update'), { file: targetFileID, metadata: metadata });
    return targetFileID;
  }

  function getFile(fileID) {
    return fileStore.get(fileID);
    // return structuredClone(fileStore.get(fileID));
  }

  function getFileMetadata(fileID) {
    return structuredClone(fileStore.get(fileID).metadata);
  }

  async function analyseFile(storedFileID) {
    let f = fileStore.get(storedFileID).obj;
    let metadata = getFileMetadata(storedFileID);
    metadata.fileID = storedFileID;

    if (!Object.keys(metadata).includes("URL")) metadata.URL = URL.createObjectURL(f);
    if (!Object.keys(metadata).includes("children")) metadata.children = new Map();
    if (!Object.keys(metadata).includes("isZip") && !Object.keys(metadata).includes("isPDF")) {

      metadata.isZip = (f.type == 'application/zip' || f.type == 'application/x-zip-compressed');
      metadata.isPDF = (f.type == 'application/pdf');

      if (f.type == '') {
        // try to guess from extension
        let ext = f.name.split('.');
        (ext.length > 1) ? ext = ext.pop().toLowerCase() : ext = "";
        metadata.isZip = (ext == 'zip');
        metadata.isPDF = (ext == 'pdf');
      }

    }

    metadata.fName = f.name;

    if (metadata.isPDF) {
      // check if it's a valid PDF
      var pdfBuffer = new Uint8Array(await f.arrayBuffer());
      var { loadSuccess, decryptionSuccess, pdfMetadata, pdf } = loadPDF(pdfBuffer, metadata.password);

      metadata = Object.assign({}, metadata, pdfMetadata);

    };

    if (metadata.isPDF && loadSuccess) {
      // // check if it's password-protected
      // // if it only has an owner-password, we can strip that out
      // let orig_encrypted = (metadata.password !== undefined || coherentpdf.isEncrypted(pdf));
      // if (metadata.password !== undefined) metadata.isEncryptedPDF = true;
      // metadata.isProtectedPDF = false;
      // // var canDecryptPDF;
      // if (orig_encrypted) {
      //   try {
      //     coherentpdf.decryptPdf(pdf, "");
      //     metadata.isProtectedPDF = true;
      //     metadata.canDecryptPDF = true;
      //     // console.log("Owner protection can be removed");
      //   } catch (e) {
      //     metadata.isEncryptedPDF = true;
      //     metadata.canDecryptPDF = false;
      //   }
      // }


      // Analyse the ranges and runs
      // only if we can get in.

      if (!metadata.isEncryptedPDF || metadata.isEncryptedPDF && metadata.password) {

        coherentpdf.decryptPdf(pdf, metadata.password ? metadata.password : "");
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
      let zipTest = await testZip(storedFileID);
      metadata.isZip = zipTest.valid;
      metadata.isEncryptedZip = zipTest.encrypted;
      metadata.zipFileCount = zipTest.files;
    };

    // Which actions are available
    let a = [];
    if (metadata.parentFile == 0) {
      if (metadata.isPDF && !metadata.isEncryptedPDF) a.push('stamp', 'mark');
      if (metadata.isPDF && metadata.isEncryptedPDF && metadata.password) a.push('stamp', 'mark');
      if (metadata.isPDF && !metadata.isEncryptedPDF && metadata.isProtectedPDF) a.push('unprotect');
      if (!metadata.isPDF && !metadata.isZip) a.push('protect');
      if (metadata.isEncryptedPDF || metadata.isEncryptedZip) a.push('open');
      if (!metadata.isEncryptedPDF && !metadata.isEncryptedZip) a.push('protect');
    };

    metadata.availableActions = new Set(a);

    fileStore.get(storedFileID).metadata = metadata;
    fireEvent('metadata', { file: storedFileID, metadata: metadata });
    return metadata;
  }

  function recordPassword(storedFileID, password) {
    if (password && !fileStore.get(storedFileID).metadata.password) {
      fileStore.get(storedFileID).metadata.password = password;
      console.log("recordPassword", storedFileID, password);
      analyseFile(storedFileID);
    };
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

  async function closeZip(zipFileID, fileName, initialMetadata = {}) {
    let f = fileStore.get(zipFileID)
    let zipWriter = f.obj;
    return await storeFile(new File([await zipWriter.close()], fileName), initialMetadata);
    // return fileStore.set(zipFileID, { obj: await zipWriter.close(), type: 'blob' });
    // return await fileStore.set(zipFileID, { obj: await zipWriter.close(), type: 'file' }).has(zipFileID) ? zipFileID : 0
  }

  async function cryptZip(storedFileID, isZip, encrypt = true, password, options = {}) {

    // Helper functions
    async function extractEntryToFile(e, initialMetadata = {}) {
      let entryBlob = await getEntryContent(e, readingOptions);
      let f = new File([entryBlob], e.filename);
      let newFileID = await storeFile(f, initialMetadata);
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


    // Here's what the function should do
    // if storedFileID is an encrypted Zip, decrypt it
    // decrypt it to a zip if it has >1 file
    // decrypt it to a file if it has 1 file
    // if storedFileID is an unencrypted Zip, encrypt it, and then offer to double lock it
    // if storedFileID is not a zip, put it in an encrypted zip

    let processID = crypto.randomUUID();
    fireEvent('processing-start', { processID: processID, file: storedFileID, process: 'zip-crypt' });

    let passwordOptions = Object.assign({ ...options }, { password: password });
    const writingOptions = encrypt ? passwordOptions : options;
    const readingOptions = encrypt ? options : passwordOptions;
    let dirOptions = Object.assign({ ...options }, { directory: true });

    let metadata = getFileMetadata(storedFileID);

    if (metadata.isEncryptedZip && !encrypt) {
      // check we can decrypt
      if (!(await isZipDecryptable(storedFileID, password))) {
        fireEvent('invalid-password', { file: storedFileID, invalidPassword: password });
        fireEvent('processing-end', { processID: processID, file: storedFileID, process: 'zip-crypt' });
        return null;
      }
    }

    if (metadata.isZip && !(metadata.isEncryptedZip && metadata.zipFileCount == 1)) {
      const entries = await getEntriesFromStoredFile(storedFileID, options);
      var newFileID = await createEmptyZip();
      for (e in entries) {
        await transferEntry(entries[e]);
        fireEvent('processing-progress', { processID: processID, file: storedFileID, current: e, total: entries.length, process: 'zip-crypt' });
      };
      let newMetadata = {
        parentFile: storedFileID,
        parentAction: (encrypt ? 'protect' : 'open'),
        password: password,
        originStory: (encrypt ? "Locked" : "Unlocked") + ` with password: <br><strong>${password}</strong>`
      }
      newFileID = await closeZip(newFileID, (encrypt ? "PASSWORD-PROTECTED " : "PASSWORD-REMOVED ") + metadata.fName, newMetadata);
      encrypt
        ? fireEvent('zip-encrypt', { input: storedFileID, output: newFileID })
        : fireEvent('zip-decrypt', { input: storedFileID, output: newFileID });

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
      fireEvent('processing-progress', { processID: processID, file: storedFileID, current: 1, total: 1, process: 'zip-crypt' });
      let newMetadata = {
        parentFile: storedFileID,
        parentAction: (encrypt ? 'protect' : 'open'),
        password: password,
        originStory: (encrypt ? "Locked" : "Unlocked") + ` with password: <br><strong>${password}</strong>`
      };
      var newFileID = await extractEntryToFile(e, newMetadata);
      fireEvent('zip-decrypt', { input: storedFileID, output: newFileID })
      //  We can check at this point if the file 
      // we've just extracted is another zip file, is also encrypted, etc.
    }

    if (!metadata.isZip) {
      // if it's just a plain old file
      let blob = getFile(storedFileID).obj
      let f = new File([blob], blob.name);
      var newFileID = await createEmptyZip();
      fireEvent('processing-progress', { processID: processID, file: storedFileID, current: 1, total: 1, process: 'zip-crypt' });
      await addFileToZip(f, newFileID, writingOptions);
      let newMetadata = {
        parentFile: storedFileID,
        parentAction: (encrypt ? 'protect' : 'open'),
        password: password,
        originStory: (encrypt ? "Locked" : "Unlocked") + ` with password: <br><strong>${password}</strong>`
      }
      newFileID = await closeZip(newFileID, "PASSWORD-PROTECTED " + metadata.fName + ".zip", newMetadata);

      fireEvent('zip-encrypt', { input: storedFileID, output: newFileID })
    }

    fireEvent('processing-end', { processID: processID, file: storedFileID, process: 'zip-crypt' });
    return newFileID;
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
    recordPassword(storedFileID, password);
    return true;
  }


  function loadPDF(pdfBuffer, decryption_pw = '') {
    const pdfMetadata = {
      isPDF: false,
      isEncryptedPDF: false,
      canDecryptPDF: false
    };
    let pdf;
    let loadSuccess = false;
    let someEncryption;
    let decryptionSuccess;

    try {

      pdf = coherentpdf.fromMemory(pdfBuffer, decryption_pw);
      loadSuccess = true;
      pdfMetadata.isPDF = true;
      someEncryption = coherentpdf.isEncrypted(pdf);
    } catch (e) {
      if (e[2].c.search(/password/, "i") >= 0) {
        // it's a pdf, but we can't load it into memory to analyse it
        pdfMetadata.isPDF = true;
        pdfMetadata.isEncryptedPDF = true;
      } else {
        pdfMetadata.isPDF = false;
        pdfMetadata.isEncryptedPDF = false;
      }
    }


    if (loadSuccess && !someEncryption) decryptionSuccess = true;
    if (loadSuccess && someEncryption) {

      pdfMetadata.isEncryptedPDF = coherentpdf.isEncrypted(pdf);
      try {
        // blank password
        coherentpdf.decryptPdf(pdf, '');
        decryptionSuccess = true;
        pdfMetadata.isEncryptedPDF = false;
        pdfMetadata.isProtectedPDF = true;
      } catch (e) { }
      if (!decryptionSuccess) {

        try {
          // supplied user password
          coherentpdf.decryptPdf(pdf, decryption_pw);
          decryptionSuccess = true;
          pdfMetadata.isEncryptedPDF = true;
          pdfMetadata.canDecryptPDF = true;
          pdfMetadata.isProtectedPDF = undefined;

          pdfMetadata.password = decryption_pw;
        } catch (e) {
        }
      }

      if (!decryptionSuccess) {
        try {
          // supplied password as owner password
          coherentpdf.decryptPdfOwner(pdf, decryption_pw);
          decryptionSuccess = true;
          pdfMetadata.isEncryptedPDF = true;
          pdfMetadata.isProtectedPDF = undefined;
          pdfMetadata.canDecryptPDF = true;
          pdfMetadata.password = decryption_pw;
        } catch (e) {
        }
      };
    }

    coherentpdf.setFast();
    return { loadSuccess, decryptionSuccess, pdfMetadata, pdf };
  }

  async function cryptPDF(storedFileID, decryption_pw = "", encryption_pw = "", unProtect = false) {
    // will try to decrypt first
    // then encrypt 
    // will always try to set owner permissions with a random password.

    const processID = crypto.randomUUID();
    fireEvent('processing-start', { processID: processID, file: storedFileID, process: 'pdf-crypt' });

    const permissions = [coherentpdf.noAnnot, coherentpdf.noAssemble, coherentpdf.noCopy, coherentpdf.noEdit, coherentpdf.noExtract, coherentpdf.noForms];
    const encryption = coherentpdf.aes256bitisotrue;
    const f = await getFile(storedFileID).obj;
    const fName = getFileMetadata(storedFileID).fName;
    const pdfBuffer = new Uint8Array(await f.arrayBuffer());

    const { loadSuccess, decryptionSuccess, pdfMetadata, pdf } = loadPDF(pdfBuffer, decryption_pw);

    if (!loadSuccess || !decryptionSuccess) {
      if (decryption_pw !== "") fireEvent('invalid-password', { file: storedFileID, invalidPassword: decryption_pw });
      fireEvent('processing-end', { processID: processID, file: storedFileID, process: 'pdf-crypt' });
      return null;
    }

    recordPassword(storedFileID, pdfMetadata.password);

    if (unProtect) {
      var pdfOut = coherentpdf.toMemory(pdf, false, false);
      var pdfBlob = new Blob([pdfOut], { type: 'application/pdf' });
      var newFileName = "UNRESTRICTED " + fileStore.get(storedFileID).metadata.fName;
      var event = 'pdf-unprotect';
      var action = 'unprotect';
      var originStory = `PDF restrictions removed`;
    } else {
      var pdfOut = coherentpdf.toMemoryEncrypted(pdf, encryption, permissions, generatePassword(), encryption_pw, false, false);
      var pdfBlob = new Blob([pdfOut], { type: 'application/pdf' });
      if (encryption_pw == '') {
        var newFileName = "PASSWORD-REMOVED " + fName;
        var event = 'pdf-decrypt';
        var action = 'open';
        var originStory = `Unlocked with password: <br><strong>${decryption_pw}</strong>`;
      } else {
        var newFileName = "PASSWORD-PROTECTED " + fName;
        var event = 'pdf-encrypt';
        var action = 'protect';
        var originStory = `Locked with password: <br><strong>${encryption_pw}</strong>`;

      }
    }

    const newFileMetadata = {
      password: encryption_pw,
      parentFile: storedFileID,
      parentAction: action,
      originStory: originStory
    };
    const newFileID = await storeFile(new File([pdfBlob], newFileName), newFileMetadata);

    fireEvent(event, { input: storedFileID, output: newFileID });
    fireEvent('processing-end', { processID: processID, file: storedFileID, process: 'pdf-crypt' });

    return newFileID;
  }

  async function markPDF(storedFileID, markText, stamp = false) {
    const processID = crypto.randomUUID();
    fireEvent('processing-start', { processID: processID, file: storedFileID, process: 'pdf-crypt' });

    const permissions = [coherentpdf.noAnnot, coherentpdf.noAssemble, coherentpdf.noCopy, coherentpdf.noEdit, coherentpdf.noExtract, coherentpdf.noForms];
    const encryption = coherentpdf.aes256bitisotrue;
    const f = await getFile(storedFileID).obj;
    const metadata = getFileMetadata(storedFileID);
    const pdfBuffer = new Uint8Array(await f.arrayBuffer());
    const { loadSuccess, decryptionSuccess, pdfMetadata, pdf } = loadPDF(pdfBuffer, metadata.password);
    coherentpdf.upright(pdf);

    let overlay_pdfs = [];

    for (const r of metadata.runs) {
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
        const fullMarkText =
          "Document prepared for release" +
          (!markText ? "" : " to " + markText) +
          " on " +
          new Date().toLocaleString("en-GB", { day: "2-digit", year: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        let fontScalePage = Math.min((width / 595), 1);

        let fontScaleText = coherentpdf.textWidth(coherentpdf.helveticaBold, "Document prepared for release to FIRSTNAME LASTNAME on 15 July 2025, 20:00") / coherentpdf.textWidth(coherentpdf.helveticaBold, fullMarkText);
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
          fullMarkText,
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
          fullMarkText,
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
      // fireEvent('pdf-progress', { input: storedFileID, current: e, total: entries.length});

    }

    // if necessary, merge the overlay pdfs
    if (overlay_pdfs.length > 1) {
      var overlayPdf = coherentpdf.mergeSimple(overlay_pdfs);
      overlay_pdfs.forEach((p) => { coherentpdf.deletePdf(p) });
    } else {
      var overlayPdf = overlay_pdfs[0];
    }

    const markedPdf = coherentpdf.combinePages(overlayPdf, pdf);

    const pdfOut = coherentpdf.toMemoryEncrypted(markedPdf, encryption, permissions, generatePassword(), "", false, false);
    const pdfBlob = new Blob([pdfOut], { type: 'application/pdf' });
    coherentpdf.deletePdf(pdf);
    coherentpdf.deletePdf(overlayPdf);
    coherentpdf.deletePdf(markedPdf);

    const newFileName = (stamp ? "STAMPED " : "MARKED ") + metadata.fName;
    const newFileMetadata = {
      parentFile: storedFileID,
      parentAction: stamp ? 'stamp' : 'mark',
      protectiveText: markText,
      originStory: (stamp ? `Stamped with: <strong>${markText}</strong>` : "Marked for release" + (markText ? ` to <br><strong>${markText}</strong>` : ""))
    };

    const newFileID = await storeFile(new File([pdfBlob], newFileName), newFileMetadata);

    fireEvent((stamp ? 'pdf-stamp' : 'pdf-mark'), { input: storedFileID, output: newFileID });
    fireEvent('processing-end', { processID: processID, file: storedFileID, process: 'pdf-mark' });

    return newFileID;
  }

  return {
    addEventListener,
    removeEventListener,
    storeFile,
    getFileMetadata,
    isZipDecryptable,
    cryptZip,
    cryptPDF,
    markPDF
  };

})();

const view = (() => {

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



  const fileDropArea = document.getElementById("drag-area");
  const fileDropInput = document.querySelector("input#file-input");
  const fileSelectButton = document.querySelector("header button.file-select-button");

  function initialise() {
    // Prevent default drag behaviours, and handle drag events

    fileDropInput.addEventListener("change", handleSelectedFiles);
    fileSelectButton.addEventListener("click", (() => { fileDropInput.click() }));


    for (eventName of ["dragenter", "dragover", "dragleave", "drop"]) {
      window.addEventListener(eventName, preventDefaults, false);
      window.addEventListener(eventName, deactivateDropZone, false);
      fileDropArea.addEventListener(eventName, preventDefaults, false);
    };

    fileDropArea.addEventListener("dragenter", activateDropZone, false);
    fileDropArea.addEventListener("dragover", activateDropZone, false);
    fileDropArea.addEventListener("dragleave", deactivateDropZone, false);
    fileDropArea.addEventListener("drop", handleDroppedFiles, false);


  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function activateDropZone(e) {
    let items = [...e.dataTransfer.items];
    if (items.some((i) => i.type !== '')) {
      fileDropArea.classList.add("highlight");
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function deactivateDropZone(e) {
    fileDropArea.classList.remove("highlight");
    e.dataTransfer.dropEffect = 'none';
  };

  function handleDroppedFiles(e) {
    deactivateDropZone(e);
    handleFiles([...e.dataTransfer.files]);
  }

  function handleSelectedFiles(e) {
    handleFiles([...this.files]);
  }

  function handleFiles(files) {
    // let handledFiles = [];
    for (f of files) {
      if (f.size > 0 || f.type !== '') {
        fireEvent('input-file', { file: f });
        // handledFiles.push(storedFileID);
      }
    };
  }


  async function displayCard(metadata) {
    // display a card for this file
    // if one doesn't exist, clone it.
    document.getElementById("introContent").classList.add("hidden");

    let card = document.querySelector("#card-id-" + metadata.fileID);
    if (card === null) {
      let blankCard = document.querySelector(".card#file-card");
      card = blankCard.cloneNode(true);
      card.id = "card-id-" + metadata.fileID;
      blankCard.insertAdjacentElement('afterend', card);
    }

    // File name
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
          "PDF locked with a password" + (metadata.password ? `<br><strong>(${metadata.password})</strong>` : "") :
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

    // Available actions, excluding children
    let actions = [...metadata.availableActions.difference(new Set(metadata.children.keys()))];

    // Set up event listeners for click and keypress
    let inputGroup = card.querySelectorAll("div.input-group");

    for (group of inputGroup) {
      if (actions.includes(group.id)) {
        // this group is one of the available actions
        // display and activate the button and input
        group.classList.remove("hidden");
        let b = group.querySelector("button");
        let inp = group.querySelector("input");
        b.removeAttribute("onclick");
        inp.removeAttribute("onchange");
        inp.removeAttribute("onkeypress");
        b.addEventListener("click", (e) => { fireEvent('action', { file: metadata.fileID, action: b.id, input: inp.value }); });
        inp.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); b.click(); } });

      }
    }

    // Add a drag and drop listener because we've covered some of the drop zone
    card.addEventListener("dragover", activateDropZone, false);
  };

  async function displayChildFile(metadata) {
    let card = document.querySelector("#card-id-" + metadata.parentFile);
    let group = card.querySelector("div.card-inputs div#" + metadata.parentAction);
    let message = group.querySelector("span.status-message");
    let input = group.querySelector("input");
    let button = group.querySelector("button");
    let a = group.querySelector("a");

    input.classList.add("hidden");

    button.classList.add("hidden");

    message.innerHTML = metadata.originStory;
    message.classList.remove("hidden");

    a.innerHTML = "Save";
    a.href = metadata.URL;
    a.download = metadata.fName;
    a.classList.add("save-button");
    a.classList.remove("hidden");


    group.classList.remove("hidden");
  }

  function displayFile(metadata) {
    // are we a parent or child?
    if (metadata.parentFile == 0) {
      // parent
      displayCard(metadata);
    } else {
      // child
      displayChildFile(metadata);

    }
  }

  function showInvalidPassword(storedFileID, invalidPassword) {
    let card = document.querySelector("#card-id-" + storedFileID);
    // let group = card.querySelector("div.card-inputs div#" + cardGroup);
    let inputs = card.querySelectorAll("input");
    for (i of inputs) {
      if (i.value == invalidPassword) {
        i.placeholder = `Could not open with "${i.value}"`;
        i.value = '';
      }
    }
  }

  return {
    addEventListener,
    removeEventListener,
    showInvalidPassword,
    initialise,
    displayFile
  }

})();

// Controller actions

view.initialise();


// Register the event listeners

// When we get a new file selected by the user
view.addEventListener('input-file', (e) => { model.storeFile(e.file, { parentFile: 0 }) });

// When the model has completed analysing a file, whether selected by the user or generated by us
model.addEventListener('metadata', (e) => {
  // Automated actions, if available and not already done.
  if (e.metadata.availableActions.has('protect') && !e.metadata.children.has('protect')) {
    executeAction(e.metadata.fileID, 'protect', '');
  }
  if (e.metadata.availableActions.has('unprotect') && !e.metadata.children.has('unprotect')) {
    executeAction(e.metadata.fileID, 'unprotect', '');
  }
  view.displayFile(e.metadata);
});

// When the user requests an action to process a file
view.addEventListener('action', (e) => { executeAction(e.file, e.action, e.input) });

// When a password has been entered and failed
model.addEventListener('invalid-password', (e) => { view.showInvalidPassword(e.file, e.invalidPassword) });


async function executeAction(storedFileID, action, input) {
  // we need to decide which model function to call, with the relevant inputs.
  let inputText = input.trim();
  let metadata = model.getFileMetadata(storedFileID);

  switch (action) {
    case 'open':
      if (metadata.isPDF) model.cryptPDF(storedFileID, inputText, '', false);
      if (metadata.isZip) model.cryptZip(storedFileID, true, false, inputText);
      break;
    case 'protect':
      let password = input.value ? input.value : generatePassword();
      if (metadata.isPDF) model.cryptPDF(storedFileID, '', password, false);
      if (!metadata.isPDF) model.cryptZip(storedFileID, true, true, password);
      break;
    case 'unprotect':
      if (metadata.isPDF) model.cryptPDF(storedFileID, inputText, "", true);
      break;
    case 'stamp':
      let stampText = inputText ? inputText : 'CONFIDENTIAL'
      if (metadata.isPDF) model.markPDF(storedFileID, stampText, true);
      break;
    case 'mark':
      let markText = inputText;
      if (metadata.isPDF) model.markPDF(storedFileID, markText, false);
      break;
  }

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

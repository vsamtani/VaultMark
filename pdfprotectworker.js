self.onmessage = function (e) {
    switch (e.data.mtype) {
        case 'location':
            importScripts(new URL('/cpdf/coherentpdf.browser.js', e.data.url).href);
        case 'pdf':
            //Load the PDF from the array of bytes handed to us by index.html
            var pdf = coherentpdf.fromMemory(e.data.bytes, "");
            coherentpdf.setFast();
            self.postMessage({ mtype: 'progress', message: '(1/4) PDF loaded successfully from file ...' });
            //Send some metadata back to index.html
            self.postMessage({ mtype: 'pages', x: coherentpdf.pages(pdf) });
            self.postMessage({ mtype: 'creator', x: coherentpdf.getCreator(pdf) });
            self.postMessage({ mtype: 'producer', x: coherentpdf.getProducer(pdf) });
            //If the PDF is encrypted with blank owner password, decrypt it.
            coherentpdf.decryptPdf(pdf, "");
            self.postMessage({ mtype: 'progress', message: '(2/4) File decrypted if necessary...' });
            //Rotate the contents of each page by 10 degrees
            //coherentpdf.rotateContents(pdf, coherentpdf.all(pdf), 10);
            //self.postMessage({mtype: 'progress', message: '(3/4) File rotated....'});
            //Seal the file and write to memory
            var permissions = [coherentpdf.noAnnot, coherentpdf.noAssemble, coherentpdf.noEdit, coherentpdf.noExtract, coherentpdf.noForms];
            var encryption = coherentpdf.aes256bitisotrue;
            let ownerPassword = "";
            while (ownerPassword.length < 30) {
                ownerPassword += Math.random().toString(36).slice(2, 7);
            };
            console.log(ownerPassword);
            var mem = coherentpdf.toMemoryEncrypted(pdf, encryption, permissions, ownerPassword, "", false, false);
            self.postMessage({ mtype: 'progress', message: '(4/4) File encrypted to memory....' });
            //Write the result to a PDF file as an array of bytes
            //var mem = coherentpdf.toMemory(pdf, false, false);
            //self.postMessage({mtype: 'progress', message: '(4/4) File serialized to memory...'});
            //Send the file back to index.html
            self.postMessage({ mtype: 'pdfout', bytes: mem });
            //This worker will be terminated by index.html, so no need to call coherentpdf.deletePdf
            break;
    }
}
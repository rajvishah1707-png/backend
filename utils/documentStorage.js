const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const directory = path.join(__dirname, '../uploads/documents');
function validateFile(file) {
    const b = file?.buffer;
    if (!b?.length) throw Object.assign(new Error('Please select a document file'), { status: 400 });
    const good = file.mimetype === 'application/pdf' ? b.subarray(0,5).toString() === '%PDF-' :
        ['image/jpeg','image/jpg'].includes(file.mimetype) ? b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff :
        file.mimetype === 'image/png' && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (!good) throw Object.assign(new Error('The file content must match PDF, JPG or PNG format'), { status: 400 });
}
function fileName(file) {
    const ext = file.mimetype === 'application/pdf' ? '.pdf' : file.mimetype === 'image/png' ? '.png' : '.jpg';
    return `document-${crypto.randomUUID()}${ext}`;
}
function available(document) {
    if (!document) return false;
    if (document.fileStorage === 'database') return Boolean(document.fileData?.length);
    return Boolean(document.fileName && fs.existsSync(path.join(directory,path.basename(document.fileName))));
}
module.exports = { validateFile, fileName, available, directory };

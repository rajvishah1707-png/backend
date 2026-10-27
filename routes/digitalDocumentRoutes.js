const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const DigitalDocument = require("../models/DigitalDocument");
const authMiddleware = require("../middleware/authMiddleware");


// =====================================================
// UPLOAD FOLDER
// =====================================================

const uploadDirectory = path.join(
    __dirname,
    "../uploads/documents"
);


// Create folder automatically if it doesn't exist
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}


// =====================================================
// MULTER STORAGE
// =====================================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(
            null,
            uploadDirectory
        );

    },

    filename: (req, file, cb) => {

        const extension =
            path.extname(file.originalname);

        const uniqueName =
            `document-${Date.now()}-${Math.round(
                Math.random() * 1000000
            )}${extension}`;

        cb(
            null,
            uniqueName
        );

    }

});


// =====================================================
// ALLOWED FILE TYPES
// =====================================================

const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png"
];


const fileFilter = (req, file, cb) => {

    if (
        allowedMimeTypes.includes(
            file.mimetype
        )
    ) {

        cb(null, true);

    } else {

        cb(
            new Error(
                "Only PDF, JPG, JPEG and PNG files are allowed"
            ),
            false
        );

    }

};


// =====================================================
// MULTER UPLOAD
// Maximum size = 5 MB
// =====================================================

const upload = multer({

    storage: storage,

    fileFilter: fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024
    }

});


// =====================================================
// HELPER FUNCTIONS
// =====================================================

const getUserId = (req) => {

    return (
        req.user?.id ||
        req.user?._id ||
        req.user?.userId
    );

};


const isValidUserId = (id) => {

    return (
        id &&
        mongoose.Types.ObjectId.isValid(id)
    );

};


const generateDocumentId = () => {

    return `DOC-${Date.now()}-${Math.floor(
        1000 + Math.random() * 9000
    )}`;

};


// =====================================================
// ADMIN CHECK
// =====================================================

const isAdminUser = (req) => {

    const role =
        req.user?.role ||
        req.user?.userType ||
        req.user?.accountType;

    if (!role) {
        return false;
    }

    return (
        role
            .toString()
            .toLowerCase() === "admin"
    );

};


// =====================================================
// GET MY DOCUMENTS
// GET /api/digital-documents/my
// =====================================================

router.get(
    "/my",
    authMiddleware,
    async (req, res) => {

        try {

            const userId =
                getUserId(req);


            if (!isValidUserId(userId)) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid user authentication"

                });

            }


            const documents =
                await DigitalDocument.find({
                    userId: userId
                })
                    .sort({
                        createdAt: -1
                    });


            return res.status(200).json({

                success: true,

                count:
                    documents.length,

                documents

            });

        } catch (error) {

            console.error(
                "Get my documents error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch digital documents"

            });

        }

    }
);


// =====================================================
// ADMIN GET ALL DOCUMENTS
// GET /api/digital-documents/admin/all
// =====================================================

router.get(
    "/admin/all",
    authMiddleware,
    async (req, res) => {

        try {

            // -----------------------------------------
            // ADMIN AUTHORIZATION
            // -----------------------------------------

            if (!isAdminUser(req)) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Admin access required"

                });

            }


            // -----------------------------------------
            // GET ALL DOCUMENTS
            // -----------------------------------------

            const documents =
                await DigitalDocument.find()
                    .sort({
                        createdAt: -1
                    });


            return res.status(200).json({

                success: true,

                count:
                    documents.length,

                documents

            });

        } catch (error) {

            console.error(
                "Admin documents error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch documents"

            });

        }

    }
);


// =====================================================
// UPLOAD DOCUMENT
// POST /api/digital-documents
// =====================================================

router.post(
    "/",
    authMiddleware,
    upload.single("document"),
    async (req, res) => {

        try {

            const userId =
                getUserId(req);


            // -----------------------------------------
            // AUTHENTICATION
            // -----------------------------------------

            if (!isValidUserId(userId)) {

                if (req.file) {

                    try {

                        if (
                            fs.existsSync(
                                req.file.path
                            )
                        ) {

                            fs.unlinkSync(
                                req.file.path
                            );

                        }

                    } catch (deleteError) {

                        console.error(
                            "Failed to delete uploaded file:",
                            deleteError
                        );

                    }

                }


                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid user authentication"

                });

            }


            // -----------------------------------------
            // FILE REQUIRED
            // -----------------------------------------

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please select a document file"

                });

            }


            const {
                citizenName,
                citizenEmail,
                documentType,
                documentTitle,
                description
            } = req.body;


            // -----------------------------------------
            // VALIDATE DOCUMENT TYPE
            // -----------------------------------------

            if (!documentType) {

                fs.unlinkSync(
                    req.file.path
                );

                return res.status(400).json({

                    success: false,

                    message:
                        "Document type is required"

                });

            }


            // -----------------------------------------
            // VALIDATE DOCUMENT TITLE
            // -----------------------------------------

            if (
                !documentTitle ||
                documentTitle
                    .trim()
                    .length < 2
            ) {

                fs.unlinkSync(
                    req.file.path
                );

                return res.status(400).json({

                    success: false,

                    message:
                        "Document title is required"

                });

            }


            // -----------------------------------------
            // CREATE DATABASE RECORD
            // -----------------------------------------

            const newDocument =
                await DigitalDocument.create({

                    documentId:
                        generateDocumentId(),

                    userId:
                        userId,

                    citizenName:
                        citizenName || "",

                    citizenEmail:
                        citizenEmail || "",

                    documentType:
                        documentType.trim(),

                    documentTitle:
                        documentTitle.trim(),

                    description:
                        description
                            ? description.trim()
                            : "",

                    originalFileName:
                        req.file.originalname,

                    fileName:
                        req.file.filename,

                    filePath:
                        `/api/digital-documents/file/${req.file.filename}`,

                    fileType:
                        req.file.mimetype,

                    fileSize:
                        req.file.size,

                    status:
                        "Pending",

                    adminRemark:
                        "",

                    reviewedBy:
                        "",

                    reviewedAt:
                        null,

                    verifiedAt:
                        null,

                    rejectedAt:
                        null

                });


            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            return res.status(201).json({

                success: true,

                message:
                    "Document uploaded successfully",

                document:
                    newDocument

            });

        } catch (error) {

            // Delete uploaded file if database fails

            if (req.file) {

                try {

                    if (
                        fs.existsSync(
                            req.file.path
                        )
                    ) {

                        fs.unlinkSync(
                            req.file.path
                        );

                    }

                } catch (deleteError) {

                    console.error(
                        "Failed to delete uploaded file:",
                        deleteError
                    );

                }

            }


            console.error(
                "Upload document error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to upload document",

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// VIEW / DOWNLOAD DOCUMENT
// GET /api/digital-documents/file/:filename
// =====================================================

router.get(
    "/file/:filename",
    authMiddleware,
    async (req, res) => {

        try {

            const filename =
                path.basename(
                    req.params.filename
                );


            const filePath =
                path.join(
                    uploadDirectory,
                    filename
                );


            // -----------------------------------------
            // CHECK PHYSICAL FILE
            // -----------------------------------------

            if (
                !fs.existsSync(
                    filePath
                )
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Document file not found"

                });

            }


            // -----------------------------------------
            // FIND DOCUMENT
            // -----------------------------------------

            const document =
                await DigitalDocument.findOne({
                    fileName:
                        filename
                });


            if (!document) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Document record not found"

                });

            }


            // -----------------------------------------
            // CHECK USER
            // -----------------------------------------

            const userId =
                getUserId(req);


            const isAdmin =
                isAdminUser(req);


            // -----------------------------------------
            // ONLY OWNER OR ADMIN
            // -----------------------------------------

            if (
                !isAdmin &&
                (
                    !userId ||
                    document.userId.toString() !==
                        userId.toString()
                )
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You are not allowed to access this document"

                });

            }


            // -----------------------------------------
            // SEND FILE
            // -----------------------------------------

            return res.sendFile(
                filePath
            );

        } catch (error) {

            console.error(
                "View document error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to open document"

            });

        }

    }
);


// =====================================================
// GET SINGLE DOCUMENT
// GET /api/digital-documents/:id
// =====================================================

router.get(
    "/:id",
    authMiddleware,
    async (req, res) => {

        try {

            const userId =
                getUserId(req);

            const documentId =
                req.params.id;


            if (!isValidUserId(userId)) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid user authentication"

                });

            }


            if (
                !mongoose.Types.ObjectId.isValid(
                    documentId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid document ID"

                });

            }


            // -----------------------------------------
            // ADMIN CAN VIEW ANY DOCUMENT
            // CITIZEN CAN VIEW OWN DOCUMENT
            // -----------------------------------------

            let document;


            if (isAdminUser(req)) {

                document =
                    await DigitalDocument.findById(
                        documentId
                    );

            } else {

                document =
                    await DigitalDocument.findOne({

                        _id:
                            documentId,

                        userId:
                            userId

                    });

            }


            if (!document) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Document not found"

                });

            }


            return res.status(200).json({

                success: true,

                document

            });

        } catch (error) {

            console.error(
                "Get document error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch document"

            });

        }

    }
);


// =====================================================
// ADMIN VERIFY DOCUMENT
// PATCH /api/digital-documents/admin/:id/verify
// =====================================================

router.patch(
    "/admin/:id/verify",
    authMiddleware,
    async (req, res) => {

        try {

            // -----------------------------------------
            // ADMIN CHECK
            // -----------------------------------------

            if (!isAdminUser(req)) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Admin access required"

                });

            }


            const documentId =
                req.params.id;


            if (
                !mongoose.Types.ObjectId.isValid(
                    documentId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid document ID"

                });

            }


            const {
                adminRemark
            } = req.body;


            const document =
                await DigitalDocument.findById(
                    documentId
                );


            if (!document) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Document not found"

                });

            }


            // -----------------------------------------
            // UPDATE STATUS
            // -----------------------------------------

            document.status =
                "Verified";

            document.adminRemark =
                adminRemark
                    ? adminRemark.trim()
                    : "";

            document.reviewedBy =
                req.user?.name ||
                req.user?.email ||
                "Admin";

            document.reviewedAt =
                new Date();

            document.verifiedAt =
                new Date();

            document.rejectedAt =
                null;


            await document.save();


            return res.status(200).json({

                success: true,

                message:
                    "Document verified successfully",

                document

            });

        } catch (error) {

            console.error(
                "Verify document error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to verify document"

            });

        }

    }
);


// =====================================================
// ADMIN REJECT DOCUMENT
// PATCH /api/digital-documents/admin/:id/reject
// =====================================================

router.patch(
    "/admin/:id/reject",
    authMiddleware,
    async (req, res) => {

        try {

            // -----------------------------------------
            // ADMIN CHECK
            // -----------------------------------------

            if (!isAdminUser(req)) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Admin access required"

                });

            }


            const documentId =
                req.params.id;


            if (
                !mongoose.Types.ObjectId.isValid(
                    documentId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid document ID"

                });

            }


            const {
                adminRemark
            } = req.body;


            // -----------------------------------------
            // REJECTION REASON REQUIRED
            // -----------------------------------------

            if (
                !adminRemark ||
                adminRemark
                    .trim()
                    .length < 3
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please provide a rejection reason"

                });

            }


            const document =
                await DigitalDocument.findById(
                    documentId
                );


            if (!document) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Document not found"

                });

            }


            // -----------------------------------------
            // UPDATE STATUS
            // -----------------------------------------

            document.status =
                "Rejected";

            document.adminRemark =
                adminRemark.trim();

            document.reviewedBy =
                req.user?.name ||
                req.user?.email ||
                "Admin";

            document.reviewedAt =
                new Date();

            document.rejectedAt =
                new Date();

            document.verifiedAt =
                null;


            await document.save();


            return res.status(200).json({

                success: true,

                message:
                    "Document rejected successfully",

                document

            });

        } catch (error) {

            console.error(
                "Reject document error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to reject document"

            });

        }

    }
);


// =====================================================
// ADMIN DELETE DOCUMENT
// DELETE /api/digital-documents/admin/:id
// =====================================================
//
// IMPORTANT:
// Admin can delete Pending / Verified / Rejected
// documents.
// =====================================================

router.delete(
    "/admin/:id",
    authMiddleware,
    async (req, res) => {

        try {

            // -----------------------------------------
            // ADMIN CHECK
            // -----------------------------------------

            if (!isAdminUser(req)) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Admin access required"

                });

            }


            const documentId =
                req.params.id;


            // -----------------------------------------
            // VALIDATE ID
            // -----------------------------------------

            if (
                !mongoose.Types.ObjectId.isValid(
                    documentId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid document ID"

                });

            }


            // -----------------------------------------
            // FIND DOCUMENT
            // -----------------------------------------

            const document =
                await DigitalDocument.findById(
                    documentId
                );


            if (!document) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Document not found"

                });

            }


            // -----------------------------------------
            // DELETE PHYSICAL FILE
            // -----------------------------------------

            if (
                document.fileName
            ) {

                const physicalPath =
                    path.join(
                        uploadDirectory,
                        path.basename(
                            document.fileName
                        )
                    );


                if (
                    fs.existsSync(
                        physicalPath
                    )
                ) {

                    try {

                        fs.unlinkSync(
                            physicalPath
                        );

                    } catch (fileDeleteError) {

                        console.error(
                            "Physical file delete error:",
                            fileDeleteError
                        );

                    }

                }

            }


            // -----------------------------------------
            // DELETE DATABASE RECORD
            // -----------------------------------------

            await DigitalDocument.deleteOne({

                _id:
                    documentId

            });


            return res.status(200).json({

                success: true,

                message:
                    "Document deleted successfully"

            });

        } catch (error) {

            console.error(
                "Admin delete document error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to delete document"

            });

        }

    }
);


// =====================================================
// CITIZEN DELETE DOCUMENT
// DELETE /api/digital-documents/:id
// =====================================================
//
// Citizen can delete ONLY their own Pending document.
// =====================================================

router.delete(
    "/:id",
    authMiddleware,
    async (req, res) => {

        try {

            const userId =
                getUserId(req);

            const documentId =
                req.params.id;


            // -----------------------------------------
            // AUTHENTICATION
            // -----------------------------------------

            if (!isValidUserId(userId)) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid user authentication"

                });

            }


            // -----------------------------------------
            // VALIDATE DOCUMENT ID
            // -----------------------------------------

            if (
                !mongoose.Types.ObjectId.isValid(
                    documentId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid document ID"

                });

            }


            // -----------------------------------------
            // ADMIN SHOULD USE ADMIN DELETE ROUTE
            // -----------------------------------------

            if (isAdminUser(req)) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Use admin delete endpoint"

                });

            }


            // -----------------------------------------
            // FIND OWN DOCUMENT
            // -----------------------------------------

            const document =
                await DigitalDocument.findOne({

                    _id:
                        documentId,

                    userId:
                        userId

                });


            if (!document) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Document not found"

                });

            }


            // -----------------------------------------
            // ONLY PENDING CAN BE DELETED
            // -----------------------------------------

            if (
                document.status !==
                "Pending"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Only pending documents can be deleted"

                });

            }


            // -----------------------------------------
            // DELETE PHYSICAL FILE
            // -----------------------------------------

            if (
                document.fileName
            ) {

                const physicalPath =
                    path.join(
                        uploadDirectory,
                        path.basename(
                            document.fileName
                        )
                    );


                if (
                    fs.existsSync(
                        physicalPath
                    )
                ) {

                    fs.unlinkSync(
                        physicalPath
                    );

                }

            }


            // -----------------------------------------
            // DELETE DATABASE RECORD
            // -----------------------------------------

            await DigitalDocument.deleteOne({

                _id:
                    documentId

            });


            return res.status(200).json({

                success: true,

                message:
                    "Document deleted successfully"

            });

        } catch (error) {

            console.error(
                "Delete document error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to delete document"

            });

        }

    }
);


// =====================================================
// MULTER / UPLOAD ERROR HANDLER
// =====================================================

router.use(
    (error, req, res, next) => {

        console.error(
            "Digital document upload error:",
            error
        );


        if (
            error instanceof multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "File size must be 5 MB or less"

                });

            }


            return res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }


        if (
            error &&
            error.message
        ) {

            return res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }


        next();

    }
);


module.exports = router;
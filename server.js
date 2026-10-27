const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    cors({
        origin: "http://localhost:3000",
        credentials: true
    })
);

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


/* =========================================================
   BASIC TEST ROUTE
========================================================= */

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Smart City API Server is running"
    });
});


/* =========================================================
   IMPORT ROUTES
========================================================= */

const authRoutes =
    require("./routes/authRoutes");

const serviceRoutes =
    require("./routes/serviceRoutes");

const serviceApplicationRoutes =
    require("./routes/serviceApplicationRoutes");

const adminRoutes =
    require("./routes/adminRoutes");

const complaintRoutes =
    require("./routes/complaintRoutes");

const notificationRoutes =
    require("./routes/notificationRoutes");

const aiRoutes =
    require("./routes/aiRoutes");

const digitalDocumentRoutes = 
    require("./routes/digitalDocumentRoutes");


/* =========================================================
   API ROUTES
========================================================= */


/* =========================
   AUTH
========================= */

app.use(
    "/api/auth",
    authRoutes
);


/* =========================
   SERVICES
========================= */

app.use(
    "/api/services",
    serviceRoutes
);


/* =========================
   SERVICE APPLICATIONS
========================= */

app.use(
    "/api/service-applications",
    serviceApplicationRoutes
);


/* =========================
   ADMIN
========================= */

app.use(
    "/api/admin",
    adminRoutes
);


/* =========================
   COMPLAINTS
========================= */

app.use(
    "/api/complaints",
    complaintRoutes
);


/* =========================
   NOTIFICATIONS
========================= */

app.use(
    "/api/notifications",
    notificationRoutes
);


/* =========================
   AI
========================= */

app.use(
    "/api/ai",
    aiRoutes
);

app.use(
    "/api/digital-documents",
    digitalDocumentRoutes
);


/* =========================================================
   API TEST ROUTES
========================================================= */

/*
   Complaint route test
*/

app.get(
    "/api/complaints-test",
    (req, res) => {

        res.status(200).json({
            success: true,
            message:
                "Complaint API route is working"
        });

    }
);


/*
   Notification route test
*/

app.get(
    "/api/notifications-test",
    (req, res) => {

        res.status(200).json({
            success: true,
            message:
                "Notification API route is working"
        });

    }
);


/* =========================================================
   404 HANDLER
========================================================= */

app.use(
    (req, res) => {

        console.log(
            "404 ROUTE NOT FOUND:",
            req.method,
            req.originalUrl
        );

        res.status(404).json({

            success: false,

            message:
                "API route not found",

            method:
                req.method,

            path:
                req.originalUrl

        });

    }
);


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
    (err, req, res, next) => {

        console.error(
            "================================="
        );

        console.error(
            "SERVER ERROR"
        );

        console.error(
            "Method:",
            req.method
        );

        console.error(
            "URL:",
            req.originalUrl
        );

        console.error(
            "Error:",
            err
        );

        console.error(
            "================================="
        );

        res.status(500).json({

            success: false,

            message:
                err.message ||
                "Internal server error"

        });

    }
);


/* =========================================================
   MONGODB CONNECTION
========================================================= */

const MONGO_URI =
    process.env.MONGO_URI;


if (!MONGO_URI) {

    console.error(
        "================================="
    );

    console.error(
        "ERROR: MONGO_URI is not defined"
    );

    console.error(
        "Please check your .env file"
    );

    console.error(
        "================================="
    );

    process.exit(1);
}


/* =========================================================
   CONNECT DATABASE
========================================================= */

mongoose
    .connect(MONGO_URI)

    .then(() => {

        console.log(
            "================================="
        );

        console.log(
            "MongoDB Connected Successfully"
        );

        console.log(
            "================================="
        );


        const PORT =
            process.env.PORT || 5000;


        /* =================================================
           START SERVER
        ================================================= */

        app.listen(
            PORT,
            () => {

                console.log(
                    "================================="
                );

                console.log(
                    "Smart City Server Started"
                );

                console.log(
                    "Port:",
                    PORT
                );

                console.log(
                    "API:",
                    "http://localhost:" + PORT
                );

                console.log(
                    "================================="
                );


                /* =========================
                   AUTH
                ========================= */

                console.log(
                    "Auth API:",
                    "http://localhost:" +
                    PORT +
                    "/api/auth"
                );


                /* =========================
                   SERVICES
                ========================= */

                console.log(
                    "Services API:",
                    "http://localhost:" +
                    PORT +
                    "/api/services"
                );


                /* =========================
                   APPLICATIONS
                ========================= */

                console.log(
                    "Applications API:",
                    "http://localhost:" +
                    PORT +
                    "/api/service-applications"
                );


                /* =========================
                   ADMIN
                ========================= */

                console.log(
                    "Admin API:",
                    "http://localhost:" +
                    PORT +
                    "/api/admin"
                );


                /* =========================
                   CITIZENS
                ========================= */

                console.log(
                    "Citizens API:",
                    "http://localhost:" +
                    PORT +
                    "/api/admin/users"
                );


                /* =========================
                   COMPLAINTS
                ========================= */

                console.log(
                    "Complaints API:",
                    "http://localhost:" +
                    PORT +
                    "/api/complaints"
                );

                console.log(
                    "My Complaints API:",
                    "http://localhost:" +
                    PORT +
                    "/api/complaints/my"
                );

                console.log(
                    "Complaint Stats API:",
                    "http://localhost:" +
                    PORT +
                    "/api/complaints/stats/summary"
                );


                /* =========================
                   ADMIN COMPLAINTS
                ========================= */

                console.log(
                    "Admin Complaints API:",
                    "http://localhost:" +
                    PORT +
                    "/api/admin/complaints"
                );


                /* =========================
                   NOTIFICATIONS
                ========================= */

                console.log(
                    "Notifications API:",
                    "http://localhost:" +
                    PORT +
                    "/api/notifications"
                );

                console.log(
                    "Notification Test API:",
                    "http://localhost:" +
                    PORT +
                    "/api/notifications-test"
                );


                /* =========================
                   AI
                ========================= */

                console.log(
                    "AI API:",
                    "http://localhost:" +
                    PORT +
                    "/api/ai"
                );

                console.log(
                    "AI Chat API:",
                    "http://localhost:" +
                    PORT +
                    "/api/ai/chat"
                );


                console.log(
                    "================================="
                );

                console.log(
                    "All Smart City APIs are ready"
                );

                console.log(
                    "================================="
                );

            }
        );

    })

    .catch((error) => {

        console.error(
            "================================="
        );

        console.error(
            "MongoDB Connection Failed"
        );

        console.error(
            error.message
        );

        console.error(
            "================================="
        );

        process.exit(1);

    });
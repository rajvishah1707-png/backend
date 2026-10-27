const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const User = require("./models/User");

const ADMIN_EMAIL = "admin@smartcity.com";
const ADMIN_PASSWORD = "Admin@123";

async function resetAdmin() {
    try {

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");

        const admin = await User.findOne({
            email: ADMIN_EMAIL
        });

        if (!admin) {

            console.log("Admin account not found");

            await mongoose.disconnect();

            return;
        }

        const hashedPassword = await bcrypt.hash(
            ADMIN_PASSWORD,
            10
        );

        admin.name = "Smart City Admin";

        admin.email = ADMIN_EMAIL;

        admin.password = hashedPassword;

        admin.phone = admin.phone || "9999999999";

        admin.address =
            "Smart City Administration Office";

        admin.city = "Ahmedabad";

        admin.pincode = "380001";

        admin.role = "admin";

        admin.isActive = true;

        await admin.save();

        console.log("");
        console.log("================================");
        console.log("ADMIN ACCOUNT RESET SUCCESSFULLY");
        console.log("================================");
        console.log("Email    :", ADMIN_EMAIL);
        console.log("Password :", ADMIN_PASSWORD);
        console.log("Role     :", admin.role);
        console.log("Active   :", admin.isActive);
        console.log("City     :", admin.city);
        console.log("Pincode  :", admin.pincode);
        console.log("================================");

        await mongoose.disconnect();

    } catch (error) {

        console.error("");
        console.error("ADMIN RESET ERROR:");
        console.error(error.message);

        try {
            await mongoose.disconnect();
        } catch (e) {}

    }
}

resetAdmin();
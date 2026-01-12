// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import dotenv from "dotenv";
import { JWT_SECRET } from "../config/env.js";
import multer from "multer";
import mailer from "../config/mailer.js";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";
import { log } from "console";

const storage = multer.memoryStorage();
export const uploadProfileImage = multer({ storage }).single("profileImg");

const uploadFromBuffer = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "user_profiles" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    Readable.from(fileBuffer).pipe(stream);
  });
};

dotenv.config();

export const signUp = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    user = new User({ name, email, password, role });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = { id: user._id };
    jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Invalid password credentials" });

    const payload = { id: user._id };
    jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

export const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found with this email" });

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    user.otpCode = otpCode;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    user.otpVerified = false;
    await user.save();

    await mailer.sendMail({
      from: `"Cart Sense Otp" <no-reply@cart-sense.com>`,
      to: email,
      subject: "Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Password Reset Request</h2>
          <p>Hi ${user.name},</p>
          <p>Your OTP for resetting your password is:</p>
          <div style="
            font-size: 24px;
            letter-spacing: 4px;
            font-weight: bold;
            color: #007bff;
          ">${otpCode}</div>
          <p>This code will expire in <strong>5 minutes</strong>.</p>
          <p>If you didn’t request this, you can ignore this email.</p>
          <br/>
          <p>Best regards,<br/>Your App Team</p>
        </div>
      `,
    });

    res.status(200).json({
      message: "OTP sent successfully to email",
    });
  } catch (error) {
    console.error("❌ Error in forgetPassword:", error);
    res.status(500).json({ message: "Failed to send OTP email" });
  }
};

export const otpCheck = async (req, res) => {
  try {
    const { email, otpCode } = req.body;
    if (!email || !otpCode)
      return res.status(400).json({ message: "Email and OTP are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otpCode !== otpCode)
      return res.status(400).json({ message: "Invalid OTP" });

    if (Date.now() > user.otpExpires)
      return res.status(400).json({ message: "OTP expired" });

    user.otpVerified = true;
    await user.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("❌ Error in otpCheck:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const newPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res
        .status(400)
        .json({ message: "Email and new password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.otpVerified)
      return res.status(400).json({
        message: "OTP verification required before resetting password",
      });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.otpCode = null;
    user.otpExpires = null;
    user.otpVerified = false;

    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("❌ Error in newPassword:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserData = async (req, res) => {
  try {
    console.log(
      "🔍 [getUserData] Full user object from token:",
      JSON.stringify(req.user, null, 2)
    );

    let userId =
      req.user.id || req.user.user?.id || req.user._id || req.user.user?._id;

    console.log("🔍 [getUserData] Trying to find user with ID:", userId);

    if (!userId) {
      return res.status(400).json({
        message: "No user ID found in token",
        tokenContents: req.user,
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        message: "User not found in database",
        searchedId: userId,
      });
    }

    res.status(200).json({
      message: "User data retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ message: "Failed to fetch user data" });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Current password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
};

export const updateUserData = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, currencyType } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (req.file) {
      try {
        const uploadResult = await uploadFromBuffer(req.file.buffer);
        user.profileImg = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error("❌ Cloudinary upload failed:", uploadErr);
        return res
          .status(500)
          .json({ message: "Image upload failed", error: uploadErr.message });
      }
    }

    if (name) user.name = name;
    if (currencyType) user.currencyType = currencyType;
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({ message: "Email already in use" });
      }
      user.email = email;
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currencyType: user.currencyType,
        profileImg: user.profileImg,
      },
    });
  } catch (error) {
    console.error("❌ Error updating user data:", error);
    res.status(500).json({ message: "Failed to update user data" });
  }
};

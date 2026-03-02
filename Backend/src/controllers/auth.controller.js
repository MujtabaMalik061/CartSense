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
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:20px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

        <!-- Header -->
        <tr>
          <td style="padding:24px 32px;font-size:26px;font-weight:bold;color:#000;">
            CartSense
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:0 32px 8px;font-size:22px;font-weight:bold;color:#111;">
            Verify Your Email
          </td>
        </tr>

        <!-- Description -->
        <tr>
          <td style="padding:0 32px 20px;font-size:14px;line-height:22px;color:#555;">
            Thank you for signing up! Please use the verification code below to complete your registration.
            This code will expire in <strong>5 minutes</strong>.
          </td>
        </tr>

        <!-- OTP Box -->
        <tr>
          <td align="center" style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f8fc;border-radius:10px;">
              <tr>
                <td align="center" style="padding:20px 0 8px;font-size:12px;letter-spacing:2px;color:#666;">
                  YOUR VERIFICATION CODE
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 0 20px;">
                  <span style="
                    display:inline-block;
                    background:#ffffff;
                    padding:14px 28px;
                    border-radius:8px;
                    font-size:32px;
                    letter-spacing:6px;
                    font-weight:bold;
                    color:#1d72b8;
                  ">
                    ${otpCode}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Security Tip -->
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7fbff;border-left:4px solid #1d72b8;">
              <tr>
                <td style="padding:12px 14px;font-size:13px;line-height:20px;color:#444;">
                  <strong>Security Tip:</strong> Never share this code with anyone. CartSense will never ask
                  for your verification code via phone or email.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer text -->
        <tr>
          <td style="padding:0 32px 24px;font-size:13px;line-height:20px;color:#777;">
            If you didn’t request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="border-top:1px solid #e5e7eb;"></td>
        </tr>

        <!-- Bottom footer -->
        <tr>
          <td align="center" style="padding:18px 32px;font-size:12px;color:#999;">
            © ${new Date().getFullYear()} CartSense. All rights reserved.<br/>
            This is an automated email, please do not reply.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
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

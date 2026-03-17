import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, updateEmail, updatePassword, deleteAccount } from "../services/authApi";
import "../styles/Account.css";

export default function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Email change state
  const [emailPassword, setEmailPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Delete account state
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((currentUser) => {
        if (!currentUser) {
          navigate("/login");
          return;
        }
        setUser(currentUser);
        setNewEmail(currentUser.email);
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    setEmailMessage("");
    setEmailError("");

    if (!emailPassword || !newEmail) {
      setEmailError("Please fill in all fields");
      return;
    }

    if (newEmail === user.email) {
      setEmailError("New email is the same as current email");
      return;
    }

    setEmailSubmitting(true);

    try {
      const response = await updateEmail(emailPassword, newEmail);
      setUser(response.user);
      setEmailMessage("Email updated successfully");
      setEmailPassword("");
    } catch (error) {
      setEmailError(error.message || "Unable to update email");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 10) {
      setPasswordError("New password must be at least 10 characters");
      return;
    }

    setPasswordSubmitting(true);

    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordMessage("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      setPasswordError(error.message || "Unable to update password");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError("");

    if (!deletePassword) {
      setDeleteError("Please enter your password");
      return;
    }

    if (deleteConfirm.toLowerCase() !== "delete") {
      setDeleteError('Please type "DELETE" to confirm');
      return;
    }

    setDeleteSubmitting(true);

    try {
      await deleteAccount(deletePassword);
      window.location.replace("/");
    } catch (error) {
      setDeleteError(error.message || "Unable to delete account");
      setDeleteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="account-page">
        <div className="account-container">
          <p>Loading account settings...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="account-page">
      <div className="account-container">
        <h1 className="account-title">Account Settings</h1>
        <p className="account-subtitle">Manage your account information and preferences</p>

        {/* Email Section */}
        <section className="account-section">
          <h2 className="section-title">Change Email Address</h2>
          <p className="section-description">
            Current email: <strong>{user.email}</strong>
          </p>

          <form className="account-form" onSubmit={handleEmailUpdate}>
            {emailMessage && <p className="form-success">{emailMessage}</p>}
            {emailError && <p className="form-error">{emailError}</p>}

            <label htmlFor="newEmail">New Email Address</label>
            <input
              type="email"
              id="newEmail"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email"
              autoComplete="email"
              required
            />

            <label htmlFor="emailPassword">Current Password</label>
            <input
              type="password"
              id="emailPassword"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Confirm with your password"
              autoComplete="current-password"
              required
            />

            <button type="submit" disabled={emailSubmitting} className="btn-primary">
              {emailSubmitting ? "Updating..." : "Update Email"}
            </button>
          </form>
        </section>

        {/* Password Section */}
        <section className="account-section">
          <h2 className="section-title">Change Password</h2>
          <p className="section-description">Choose a strong password with at least 10 characters</p>

          <form className="account-form" onSubmit={handlePasswordUpdate}>
            {passwordMessage && <p className="form-success">{passwordMessage}</p>}
            {passwordError && <p className="form-error">{passwordError}</p>}

            <label htmlFor="currentPassword">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              required
            />

            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (10+ characters)"
              autoComplete="new-password"
              minLength={10}
              required
            />

            <label htmlFor="confirmNewPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmNewPassword"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              minLength={10}
              required
            />

            <button type="submit" disabled={passwordSubmitting} className="btn-primary">
              {passwordSubmitting ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        {/* Danger Zone - Delete Account */}
        <section className="account-section danger-zone">
          <h2 className="section-title danger-title">Danger Zone</h2>
          <p className="section-description">
            Once you delete your account, all your saved builds and data will be permanently removed.
            This action cannot be undone.
          </p>

          <form className="account-form" onSubmit={handleDeleteAccount}>
            {deleteError && <p className="form-error">{deleteError}</p>}

            <label htmlFor="deletePassword">Current Password</label>
            <input
              type="password"
              id="deletePassword"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            <label htmlFor="deleteConfirm">Type "DELETE" to confirm</label>
            <input
              type="text"
              id="deleteConfirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE in all caps"
              required
            />

            <button type="submit" disabled={deleteSubmitting} className="btn-danger">
              {deleteSubmitting ? "Deleting..." : "Delete My Account"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { FiAlertCircle, FiCheck, FiKey, FiLoader, FiUser, FiUserPlus, FiX } from "react-icons/fi";
import type { Role, User } from "../../api/users";
import type { UserFormData } from "./userManagementTypes";

type UserManagementModalProps = {
  mode: "create" | "edit";
  selectedUser: User | null;
  roles: Role[];
  formData: UserFormData;
  formErrors: Partial<Record<keyof UserFormData, string>>;
  submitError: string | null;
  showPasswordChange: boolean;
  newPassword: string;
  confirmNewPassword: string;
  passwordError: string | null;
  isChangingPassword: boolean;
  isSubmitting: boolean;
  setFormData: Dispatch<SetStateAction<UserFormData>>;
  setShowPasswordChange: (value: boolean) => void;
  setNewPassword: (value: string) => void;
  setConfirmNewPassword: (value: string) => void;
  resetPasswordChange: () => void;
  onChangePassword: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function UserManagementModal({
  mode,
  selectedUser,
  roles,
  formData,
  formErrors,
  submitError,
  showPasswordChange,
  newPassword,
  confirmNewPassword,
  passwordError,
  isChangingPassword,
  isSubmitting,
  setFormData,
  setShowPasswordChange,
  setNewPassword,
  setConfirmNewPassword,
  resetPasswordChange,
  onChangePassword,
  onClose,
  onSubmit,
}: UserManagementModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1012]/20 backdrop-blur-sm">
      <div className="bg-[#fdfdfd] border border-[#0f1012]/[0.08] rounded-[10px] w-[480px] shadow-elevated overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#0f1012]/[0.08]">
          <div className="flex items-center gap-3">
            <div className="size-10 flex items-center justify-center bg-[#0f1012]/[0.05] border border-[#0f1012]/[0.08] rounded-[10px]">
              <FiUser className="text-[#0f1012]" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#0f1012]">
                {mode === "create" ? "Create User" : "Edit User"}
              </h3>
              <p className="text-xs text-[#868788]">
                {mode === "create" ? "Add a new user to the system" : "Update user details"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#868788] hover:text-[#0f1012] transition-colors">
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {submitError && (
            <div className="p-3 bg-[#ffebee]/40 border border-[#b71c1c]/20 rounded-[10px] flex items-center gap-2">
              <FiAlertCircle className="text-[#b71c1c]" />
              <span className="text-sm text-[#b71c1c]">{submitError}</span>
            </div>
          )}

          <div>
            <label htmlFor="user-full-name" className="block text-[10px] font-medium uppercase text-[#868788] mb-1.5 tracking-wider">
              Full Name
            </label>
            <input
              id="user-full-name"
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
              className={`w-full px-3 py-2.5 bg-[#0f1012]/[0.04] text-sm text-[#020201] border rounded-[10px] focus:outline-none transition-all placeholder:text-[#868788] ${
                formErrors.full_name ? "border-[#b71c1c]/50 focus:border-[#b71c1c]" : "border-[#0f1012]/[0.08] focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20"
              }`}
              placeholder="John Doe"
            />
            {formErrors.full_name && <p className="mt-1 text-xs text-[#b71c1c]">{formErrors.full_name}</p>}
          </div>

          <div>
            <label htmlFor="user-email" className="block text-[10px] font-medium uppercase text-[#868788] mb-1.5 tracking-wider">
              Email Address
            </label>
            <input
              id="user-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              className={`w-full px-3 py-2.5 bg-[#0f1012]/[0.04] text-sm text-[#020201] border rounded-[10px] focus:outline-none transition-all placeholder:text-[#868788] ${
                formErrors.email ? "border-[#b71c1c]/50 focus:border-[#b71c1c]" : "border-[#0f1012]/[0.08] focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20"
              }`}
              placeholder="john@example.com"
            />
            {formErrors.email && <p className="mt-1 text-xs text-[#b71c1c]">{formErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="user-role" className="block text-[10px] font-medium uppercase text-[#868788] mb-1.5 tracking-wider">
              Role
            </label>
            <select
              id="user-role"
              value={formData.role_id ?? ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, role_id: e.target.value ? Number(e.target.value) : null }))}
              className={`w-full px-3 py-2.5 bg-[#0f1012]/[0.04] text-sm text-[#020201] border rounded-[10px] focus:outline-none transition-all appearance-none cursor-pointer ${
                formErrors.role_id ? "border-[#b71c1c]/50 focus:border-[#b71c1c]" : "border-[#0f1012]/[0.08] focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20"
              }`}
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {formErrors.role_id && <p className="mt-1 text-xs text-[#b71c1c]">{formErrors.role_id}</p>}
          </div>

          {mode === "edit" && selectedUser && selectedUser.roles.name === "Operator" && (
            <div className="pt-2 border-t border-[#0f1012]/[0.08]">
              {!showPasswordChange ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(true)}
                  className="flex items-center gap-2 text-sm text-[#8f8f8f] hover:text-[#0f1012] transition-colors"
                >
                  <FiKey size={14} />
                  Change Password
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="operator-password-panel" className="text-[10px] font-medium uppercase text-[#868788] tracking-wider">
                      Change Password
                    </label>
                    <button
                      type="button"
                      onClick={resetPasswordChange}
                      className="text-xs text-[#868788] hover:text-[#0f1012] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {passwordError && (
                    <div className="p-2 bg-[#ffebee]/40 border border-[#b71c1c]/20 rounded-[10px] flex items-center gap-2">
                      <FiAlertCircle className="text-[#b71c1c] shrink-0" size={14} />
                      <span className="text-xs text-[#b71c1c]">{passwordError}</span>
                    </div>
                  )}

                  <input
                    id="operator-password-panel"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0f1012]/[0.04] text-sm text-[#020201] border border-[#0f1012]/[0.08] rounded-[10px] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all placeholder:text-[#868788]"
                    placeholder="New password (min 8 characters)"
                  />

                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0f1012]/[0.04] text-sm text-[#020201] border border-[#0f1012]/[0.08] rounded-[10px] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all placeholder:text-[#868788]"
                    placeholder="Confirm new password"
                  />

                  <button
                    type="button"
                    onClick={onChangePassword}
                    disabled={isChangingPassword}
                    className="w-full px-3 py-2 rounded-[10px] text-sm font-normal bg-[#0f1012]/[0.05] text-[#0f1012] border border-[#0f1012]/[0.08] hover:bg-[#0f1012]/[0.10] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <>
                        <FiLoader className="animate-spin" size={14} />
                        Changing&hellip;
                      </>
                    ) : (
                      <>
                        <FiKey size={14} />
                        Update Password
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === "create" && (
            <>
              <div>
                <label htmlFor="user-password" className="block text-[10px] font-medium uppercase text-[#868788] mb-1.5 tracking-wider">
                  Password
                </label>
                <input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                  className={`w-full px-3 py-2.5 bg-[#0f1012]/[0.04] text-sm text-[#020201] border rounded-[10px] focus:outline-none transition-all placeholder:text-[#868788] ${
                    formErrors.password ? "border-[#b71c1c]/50 focus:border-[#b71c1c]" : "border-[#0f1012]/[0.08] focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20"
                  }`}
                  placeholder="Minimum 8 characters"
                />
                {formErrors.password && <p className="mt-1 text-xs text-[#b71c1c]">{formErrors.password}</p>}
              </div>

              <div>
                <label htmlFor="user-confirm-password" className="block text-[10px] font-medium uppercase text-[#868788] mb-1.5 tracking-wider">
                  Confirm Password
                </label>
                <input
                  id="user-confirm-password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className={`w-full px-3 py-2.5 bg-[#0f1012]/[0.04] text-sm text-[#020201] border rounded-[10px] focus:outline-none transition-all placeholder:text-[#868788] ${
                    formErrors.confirmPassword
                      ? "border-[#b71c1c]/50 focus:border-[#b71c1c]"
                      : "border-[#0f1012]/[0.08] focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20"
                  }`}
                  placeholder="Re-enter password"
                />
                {formErrors.confirmPassword && <p className="mt-1 text-xs text-[#b71c1c]">{formErrors.confirmPassword}</p>}
              </div>
            </>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-[10px] text-sm font-normal text-[#8f8f8f] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.05] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[#0f1012] text-white hover:bg-[#020201] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <FiLoader className="animate-spin" />
                  {mode === "create" ? "Creating\u2026" : "Saving\u2026"}
                </>
              ) : mode === "create" ? (
                <>
                  <FiUserPlus size={14} />
                  Create User
                </>
              ) : (
                <>
                  <FiCheck size={14} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

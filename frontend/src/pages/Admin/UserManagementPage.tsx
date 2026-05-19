import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  FiUsers,
  FiShield,
  FiSearch,
  FiFilter,
  FiEdit2,
  FiPower,
  FiUserPlus,
  FiX,
  FiChevronRight,
  FiLoader,
  FiCheck,
  FiAlertCircle,
  FiUser,
  FiKey,
} from "react-icons/fi";
import {
  getUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  getRoles,
  changeUserPassword,
} from "../../api/users";
import type { User, Role, CreateUserInput, UpdateUserInput } from "../../api/users";

interface UserFormData {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role_id: number | null;
}

const initialFormData: UserFormData = {
  full_name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role_id: null,
};

const formatDisplayDate = (value: string) => new Date(value).toLocaleDateString();

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers({
        q: searchQuery || undefined,
        role: roleFilter || undefined,
        active: statusFilter === "" ? undefined : statusFilter === "active",
      });
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, statusFilter]);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await getRoles();
      const allowedRoles = data.filter((r) => r.name === "Admin" || r.name === "Operator");
      setRoles(allowedRoles);
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
    admins: users.filter((u) => u.roles.name === "Admin").length,
    operators: users.filter((u) => u.roles.name === "Operator").length,
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedUser(null);
    setFormData(initialFormData);
    setFormErrors({});
    setSubmitError(null);
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode("edit");
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: "",
      confirmPassword: "",
      role_id: user.roles.id,
    });
    setFormErrors({});
    setSubmitError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setFormData(initialFormData);
    setFormErrors({});
    setSubmitError(null);
    setShowPasswordChange(false);
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordError(null);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof UserFormData, string>> = {};

    if (!formData.full_name.trim()) {
      errors.full_name = "Full name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = "Invalid email format";
      }
    }

    if (modalMode === "create") {
      if (!formData.password) {
        errors.password = "Password is required";
      } else if (formData.password.length < 8) {
        errors.password = "Password must be at least 8 characters";
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    if (!formData.role_id) {
      errors.role_id = "Role is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (modalMode === "create") {
        const input: CreateUserInput = {
          email: formData.email.trim(),
          full_name: formData.full_name.trim(),
          password: formData.password,
          role_id: formData.role_id!,
        };
        await createUser(input);
        setSuccessMessage("User created successfully");
      } else if (selectedUser) {
        const input: UpdateUserInput = {
          email: formData.email.trim(),
          full_name: formData.full_name.trim(),
          role_id: formData.role_id!,
        };
        await updateUser(selectedUser.id, input);
        setSuccessMessage("User updated successfully");
      }

      closeModal();
      fetchUsers();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (togglingUserId) return;

    setTogglingUserId(user.id);
    try {
      await toggleUserStatus(user.id, !user.is_active);
      setSuccessMessage(`User ${user.is_active ? "deactivated" : "activated"} successfully`);
      fetchUsers();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: unknown) {
      setSuccessMessage(error instanceof Error ? error.message : "Failed to toggle user status");
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    if (!newPassword || newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);

    try {
      await changeUserPassword(selectedUser.id, newPassword);
      setSuccessMessage("Password changed successfully");
      setShowPasswordChange(false);
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: unknown) {
      setPasswordError(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const isSelf = (userId: number) => currentUser?.id === userId;

  if (!currentUser || currentUser.role?.name !== "Admin") {
    return (
      <div className="flex items-center justify-center h-full bg-[#f2f2f4]">
        <div className="p-10 border border-[#b71c1c]/20 bg-[#ffebee]/30 text-center max-w-md rounded-[10px]">
          <FiShield className="mx-auto text-5xl text-[#b71c1c] mb-6" />
          <h2 className="text-2xl font-medium text-[#0f1012] mb-2 uppercase tracking-widest">Access Denied</h2>
          <p className="text-[#b71c1c] text-sm">Administrator privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f2f2f4] text-[#0f1012] overflow-hidden relative font-sans">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#0f1012]/[0.08] z-10 shrink-0 bg-[#fdfdfd]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 flex items-center justify-center border border-[#0f1012]/[0.08] bg-[#f2f2f4] text-[#0f1012] rounded-[10px]">
                <FiUsers size={20} />
              </div>
              <h1 className="text-2xl font-medium tracking-tight text-[#0f1012]">User Management</h1>
            </div>
            <p className="text-[#868788] text-xs tracking-widest uppercase pl-14">
              System Users // Access Control
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-[#0f1012] text-white font-medium text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-[#020201] transition-colors rounded-[10px]"
          >
            <FiUserPlus size={16} />
            Add User
          </button>
        </div>
      </div>

      {/* Success/Error Banner */}
      {successMessage && (
        <div className="mx-8 mt-4 p-3 bg-[#e8f5e9]/40 border border-[#1b5e20]/20 rounded-[10px] flex items-center gap-2 z-10">
          <FiCheck className="text-[#1b5e20]" />
          <span className="text-sm text-[#1b5e20]">{successMessage}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-8 py-3 z-10 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 bg-[#fdfdfd] border border-[#0f1012]/[0.06] rounded-[10px] shadow-card">
          <div className="text-xl font-medium text-[#0f1012] tabular-nums">{stats.total}</div>
          <div className="text-[9px] text-[#868788] uppercase tracking-wider">Total</div>
        </div>
        <div className="p-3 bg-[#fdfdfd] border border-[#1b5e20]/15 rounded-[10px] shadow-card">
          <div className="text-xl font-medium text-[#1b5e20] tabular-nums">{stats.active}</div>
          <div className="text-[9px] text-[#868788] uppercase tracking-wider">Active</div>
        </div>
        <div className="p-3 bg-[#fdfdfd] border border-[#0f1012]/[0.06] rounded-[10px] shadow-card">
          <div className="text-xl font-medium text-[#8f8f8f] tabular-nums">{stats.inactive}</div>
          <div className="text-[9px] text-[#868788] uppercase tracking-wider">Inactive</div>
        </div>
        <div className="p-3 bg-[#fdfdfd] border border-[#0f1012]/[0.06] rounded-[10px] shadow-card">
          <div className="text-xl font-medium text-[#0f1012] tabular-nums">{stats.admins}</div>
          <div className="text-[9px] text-[#868788] uppercase tracking-wider">Admins</div>
        </div>
        <div className="p-3 bg-[#fdfdfd] border border-[#0f1012]/[0.06] rounded-[10px] shadow-card">
          <div className="text-xl font-medium text-[#0f1012] tabular-nums">{stats.operators}</div>
          <div className="text-[9px] text-[#868788] uppercase tracking-wider">Operators</div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-3 z-10 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868788]" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 bg-[#fdfdfd] border border-[#0f1012]/[0.08] text-xs text-[#0f1012] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] rounded-[10px] transition-all"
          />
        </div>

        <div className="relative">
          <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868788]" size={14} />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-[#fdfdfd] border border-[#0f1012]/[0.08] text-xs text-[#8f8f8f] focus:outline-none focus:border-[#0f1012]/[0.18] appearance-none cursor-pointer min-w-[140px] uppercase tracking-wider rounded-[10px]"
          >
            <option value="">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
          <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-[#868788]" size={12} />
        </div>

        <div className="relative">
          <FiPower className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868788]" size={14} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-[#fdfdfd] border border-[#0f1012]/[0.08] text-xs text-[#8f8f8f] focus:outline-none focus:border-[#0f1012]/[0.18] appearance-none cursor-pointer min-w-[140px] uppercase tracking-wider rounded-[10px]"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-[#868788]" size={12} />
        </div>
      </div>

      {/* User Table */}
      <div className="flex-1 overflow-y-auto px-8 py-2 z-10 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#868788] gap-4">
            <FiLoader className="animate-spin text-3xl opacity-50" />
            <p className="text-xs uppercase tracking-widest">Loading Users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#868788] opacity-60">
            <FiUsers className="text-4xl mb-4" />
            <p className="text-xs uppercase tracking-widest">No Users Found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {users.map((user, idx) => (
              <div
                key={user.id}
                style={{ animationDelay: `${idx * 15}ms` }}
                className={`group relative overflow-hidden border-l-2 transition-all duration-200 bg-[#fdfdfd] border-y border-r border-y-[#0f1012]/[0.04] border-r-[#0f1012]/[0.04] hover:bg-[#f2f2f4] ${
                  user.is_active ? "border-l-[#1b5e20]/50" : "border-l-[#0f1012]/[0.10]"
                } ${isSelf(user.id) ? "ring-1 ring-[#0f1012]/[0.08]" : ""}`}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-white font-medium text-xs shrink-0 ${
                      user.is_active
                        ? "bg-[#f2f2f4] border border-[#0f1012]/[0.08] text-[#0f1012]"
                        : "bg-[#fdfdfd] border border-[#0f1012]/[0.08] text-[#8f8f8f]"
                    }`}
                  >
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#0f1012] font-normal text-sm truncate">{user.full_name}</span>
                      {isSelf(user.id) && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-[#0f1012]/[0.06] text-[#8f8f8f] rounded uppercase">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#868788] truncate">{user.email}</div>
                  </div>

                  <div
                    className={`px-2 py-0.5 text-[9px] font-normal uppercase tracking-wider border shrink-0 rounded-[6px] ${
                      user.roles.name === "Admin"
                        ? "text-[#0f1012] border-[#0f1012]/[0.08] bg-[#f2f2f4]"
                        : "text-[#8f8f8f] border-[#0f1012]/[0.08] bg-[#fdfdfd]"
                    }`}
                  >
                    {user.roles.name}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`size-1.5 rounded-full ${user.is_active ? "bg-[#1b5e20]" : "bg-[#868788]"}`} />
                    <span className="text-[9px] text-[#868788] uppercase w-12">{user.is_active ? "Active" : "Inactive"}</span>
                  </div>

                  <div className="hidden lg:block text-[9px] text-[#868788] shrink-0 w-20">
                    {formatDisplayDate(user.created_at)}
                  </div>

                  <div className="flex items-center shrink-0">
                    <button
                      onClick={() => openEditModal(user)}
                      disabled={isSelf(user.id)}
                      title={isSelf(user.id) ? "Cannot modify your own account" : "Edit user"}
                      className={`p-1.5 rounded transition-colors ${
                        isSelf(user.id)
                          ? "text-[#0f1012]/20 cursor-not-allowed"
                          : "text-[#868788] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.05]"
                      }`}
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user)}
                      disabled={isSelf(user.id) || togglingUserId === user.id}
                      title={
                        isSelf(user.id)
                          ? "Cannot modify your own account"
                          : user.is_active
                          ? "Deactivate user"
                          : "Activate user"
                      }
                      className={`p-1.5 rounded transition-colors ${
                        isSelf(user.id)
                          ? "text-[#0f1012]/20 cursor-not-allowed"
                          : user.is_active
                          ? "text-[#868788] hover:text-[#b71c1c] hover:bg-[#ffebee]"
                          : "text-[#868788] hover:text-[#1b5e20] hover:bg-[#e8f5e9]"
                      }`}
                    >
                      {togglingUserId === user.id ? <FiLoader className="animate-spin" size={13} /> : <FiPower size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#0f1012]/[0.08] px-8 py-4 bg-[#fdfdfd] z-10">
        <p className="text-[10px] text-[#868788] uppercase tracking-wider">
          Displaying <span className="text-[#0f1012]">{users.length}</span> users
        </p>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1012]/20 backdrop-blur-sm">
          <div className="bg-[#fdfdfd] border border-[#0f1012]/[0.08] rounded-[10px] w-[480px] shadow-elevated overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#0f1012]/[0.08]">
              <div className="flex items-center gap-3">
                <div className="size-10 flex items-center justify-center bg-[#0f1012]/[0.05] border border-[#0f1012]/[0.08] rounded-[10px]">
                  <FiUser className="text-[#0f1012]" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-[#0f1012]">
                    {modalMode === "create" ? "Create User" : "Edit User"}
                  </h3>
                  <p className="text-xs text-[#868788]">
                    {modalMode === "create" ? "Add a new user to the system" : "Update user details"}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-[#868788] hover:text-[#0f1012] transition-colors">
                <FiX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-[#ffebee]/40 border border-[#b71c1c]/20 rounded-[10px] flex items-center gap-2">
                  <FiAlertCircle className="text-[#b71c1c]" />
                  <span className="text-sm text-[#b71c1c]">{submitError}</span>
                </div>
              )}

              {/* Full Name */}
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
                {formErrors.full_name && (
                  <p className="mt-1 text-xs text-[#b71c1c]">{formErrors.full_name}</p>
                )}
              </div>

              {/* Email */}
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

              {/* Role */}
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

              {/* Password Change Section - Only for editing Operators */}
              {modalMode === "edit" && selectedUser && selectedUser.roles.name === "Operator" && (
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
                          onClick={() => {
                            setShowPasswordChange(false);
                            setNewPassword("");
                            setConfirmNewPassword("");
                            setPasswordError(null);
                          }}
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
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="w-full px-3 py-2 rounded-[10px] text-sm font-normal bg-[#0f1012]/[0.05] text-[#0f1012] border border-[#0f1012]/[0.08] hover:bg-[#0f1012]/[0.10] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isChangingPassword ? (
                          <>
                            <FiLoader className="animate-spin" size={14} />
                            Changing...
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

              {/* Password - Only for create mode */}
              {modalMode === "create" && (
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
                    {formErrors.password && (
                      <p className="mt-1 text-xs text-[#b71c1c]">{formErrors.password}</p>
                    )}
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
                    {formErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-[#b71c1c]">{formErrors.confirmPassword}</p>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={closeModal}
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
                      {modalMode === "create" ? "Creating..." : "Saving..."}
                    </>
                  ) : modalMode === "create" ? (
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
      )}
    </div>
  );
}

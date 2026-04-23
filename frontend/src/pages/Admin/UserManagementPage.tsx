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

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Toggle status state
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // Password change state (only for editing operators)
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
      // Only allow Admin and Operator roles
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

  // Stats
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
    // Reset password change state
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
    } catch (error: any) {
      setSubmitError(error.message || "An error occurred");
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
    } catch (error: any) {
      setSuccessMessage(error.message || "Failed to toggle user status");
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    // Validate password
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
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const isSelf = (userId: number) => currentUser?.id === userId;

  // Access Denied
  if (!currentUser || currentUser.role?.name !== "Admin") {
    return (
      <div className="flex items-center justify-center h-full bg-[#020408]">
        <div
          className="p-10 border border-rose-500/20 bg-rose-950/10 text-center max-w-md"
          style={{ clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)" }}
        >
          <FiShield className="mx-auto text-5xl text-rose-500 mb-6 animate-pulse" />
          <h2 className="text-2xl font-bold font-mono text-white mb-2 uppercase tracking-widest">Access Denied</h2>
          <p className="text-rose-400 font-mono text-sm">Administrator privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#020408] text-white overflow-hidden relative font-sans">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <div className="px-8 py-6 border-b border-cyan-900/20 z-10 shrink-0 bg-[#020408]/90 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 flex items-center justify-center border border-cyan-500/30 bg-cyan-950/20 text-cyan-400">
                <FiUsers size={20} />
              </div>
              <h1 className="text-2xl font-bold tracking-widest text-white uppercase font-mono">User Management</h1>
            </div>
            <p className="text-cyan-900/60 text-xs font-mono tracking-widest uppercase pl-14">
              System Users // Access Control
            </p>
          </div>

          {/* Add User Button */}
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-cyan-500 text-navy-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <FiUserPlus size={16} />
            Add User
          </button>
        </div>
      </div>

      {/* Success/Error Banner */}
      {successMessage && (
        <div className="mx-8 mt-4 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 z-10">
          <FiCheck className="text-emerald-400" />
          <span className="text-sm text-emerald-300">{successMessage}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-8 py-3 z-10 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-[#050b14]/80 border border-white/5 rounded-lg">
          <div className="text-xl font-bold text-white font-mono">{stats.total}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Total</div>
        </div>
        <div className="p-3 bg-[#050b14]/80 border border-emerald-500/20 rounded-lg">
          <div className="text-xl font-bold text-emerald-400 font-mono">{stats.active}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Active</div>
        </div>
        <div className="p-3 bg-[#050b14]/80 border border-slate-500/20 rounded-lg">
          <div className="text-xl font-bold text-slate-400 font-mono">{stats.inactive}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Inactive</div>
        </div>
        <div className="p-3 bg-[#050b14]/80 border border-cyan-500/20 rounded-lg">
          <div className="text-xl font-bold text-cyan-400 font-mono">{stats.admins}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Admins</div>
        </div>
        <div className="p-3 bg-[#050b14]/80 border border-violet-500/20 rounded-lg">
          <div className="text-xl font-bold text-violet-400 font-mono">{stats.operators}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Operators</div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-3 z-10 flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-700" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 bg-[#050b14]/80 border border-cyan-900/30 text-xs font-mono text-cyan-300 placeholder:text-cyan-900/50 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Role Filter */}
        <div className="relative">
          <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-700" size={14} />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-[#050b14]/80 border border-cyan-900/30 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[140px] uppercase tracking-wider"
          >
            <option value="">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
          <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-cyan-700" size={12} />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <FiPower className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-700" size={14} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-[#050b14]/80 border border-cyan-900/30 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[140px] uppercase tracking-wider"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-cyan-700" size={12} />
        </div>
      </div>

      {/* User Table */}
      <div className="flex-1 overflow-y-auto px-8 py-2 z-10 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-cyan-900 gap-4">
            <FiLoader className="animate-spin text-3xl opacity-50" />
            <p className="font-mono text-xs uppercase tracking-widest animate-pulse">Loading Users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 opacity-60">
            <FiUsers className="text-4xl mb-4 text-cyan-900" />
            <p className="font-mono text-xs uppercase tracking-widest text-cyan-800">No Users Found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {users.map((user, idx) => (
              <div
                key={user.id}
                style={{ animationDelay: `${idx * 15}ms` }}
                className={`group relative overflow-hidden border-l-2 transition-all duration-200 animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards bg-[#03060c] border-y border-r border-y-white/5 border-r-white/5 hover:bg-[#050910] ${
                  user.is_active ? "border-l-emerald-500/50" : "border-l-slate-600"
                } ${isSelf(user.id) ? "ring-1 ring-cyan-500/20" : ""}`}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  {/* Avatar - smaller */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                      user.is_active
                        ? "bg-gradient-to-br from-cyan-600 to-blue-700"
                        : "bg-gradient-to-br from-slate-600 to-slate-700"
                    }`}
                  >
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm truncate">{user.full_name}</span>
                      {isSelf(user.id) && (
                        <span className="text-[8px] px-1 py-0.5 bg-cyan-500/20 text-cyan-400 rounded font-mono uppercase">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">{user.email}</div>
                  </div>

                  {/* Role Badge */}
                  <div
                    className={`px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider border shrink-0 ${
                      user.roles.name === "Admin"
                        ? "text-cyan-400 border-cyan-500/30 bg-cyan-950/20"
                        : "text-violet-400 border-violet-500/30 bg-violet-950/20"
                    }`}
                  >
                    {user.roles.name}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-slate-600"}`} />
                    <span className="text-[9px] text-slate-500 font-mono uppercase w-12">{user.is_active ? "Active" : "Inactive"}</span>
                  </div>

                  {/* Created Date */}
                  <div className="hidden lg:block text-[9px] text-cyan-900 font-mono shrink-0 w-20">
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center shrink-0">
                    <button
                      onClick={() => openEditModal(user)}
                      disabled={isSelf(user.id)}
                      title={isSelf(user.id) ? "Cannot modify your own account" : "Edit user"}
                      className={`p-1.5 rounded transition-colors ${
                        isSelf(user.id)
                          ? "text-slate-700 cursor-not-allowed"
                          : "text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10"
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
                          ? "text-slate-700 cursor-not-allowed"
                          : user.is_active
                          ? "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                          : "text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10"
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
      <div className="flex items-center justify-between border-t border-white/5 px-8 py-4 bg-[#020408]/90 z-10">
        <p className="text-[10px] text-cyan-900 font-mono uppercase tracking-wider">
          Displaying <span className="text-cyan-400">{users.length}</span> users
        </p>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0a0e1a] border border-cyan-500/30 rounded-xl w-[480px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <FiUser className="text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {modalMode === "create" ? "Create User" : "Edit User"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {modalMode === "create" ? "Add a new user to the system" : "Update user details"}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-slate-500 hover:text-white transition-colors">
                <FiX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg flex items-center gap-2">
                  <FiAlertCircle className="text-rose-400" />
                  <span className="text-sm text-rose-300">{submitError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className={`w-full px-3 py-2.5 bg-black/30 text-sm text-white border rounded-lg focus:outline-none transition-all placeholder:text-slate-600 ${
                    formErrors.full_name ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-cyan-500/50"
                  }`}
                  placeholder="John Doe"
                />
                {formErrors.full_name && (
                  <p className="mt-1 text-xs text-rose-400">{formErrors.full_name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2.5 bg-black/30 text-sm text-white border rounded-lg focus:outline-none transition-all placeholder:text-slate-600 ${
                    formErrors.email ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-cyan-500/50"
                  }`}
                  placeholder="john@example.com"
                />
                {formErrors.email && <p className="mt-1 text-xs text-rose-400">{formErrors.email}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wider">
                  Role
                </label>
                <select
                  value={formData.role_id ?? ""}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value ? Number(e.target.value) : null })}
                  className={`w-full px-3 py-2.5 bg-black/30 text-sm text-white border rounded-lg focus:outline-none transition-all appearance-none cursor-pointer ${
                    formErrors.role_id ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-cyan-500/50"
                  }`}
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                {formErrors.role_id && <p className="mt-1 text-xs text-rose-400">{formErrors.role_id}</p>}
              </div>

              {/* Password Change Section - Only for editing Operators */}
              {modalMode === "edit" && selectedUser && selectedUser.roles.name === "Operator" && (
                <div className="pt-2 border-t border-white/10">
                  {!showPasswordChange ? (
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(true)}
                      className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <FiKey size={14} />
                      Change Password
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
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
                          className="text-xs text-slate-500 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>

                      {passwordError && (
                        <div className="p-2 bg-rose-950/30 border border-rose-500/30 rounded-lg flex items-center gap-2">
                          <FiAlertCircle className="text-rose-400 shrink-0" size={14} />
                          <span className="text-xs text-rose-300">{passwordError}</span>
                        </div>
                      )}

                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/30 text-sm text-white border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600"
                        placeholder="New password (min 8 characters)"
                      />

                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/30 text-sm text-white border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600"
                        placeholder="Confirm new password"
                      />

                      <button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wider">
                      Password
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full px-3 py-2.5 bg-black/30 text-sm text-white border rounded-lg focus:outline-none transition-all placeholder:text-slate-600 ${
                        formErrors.password ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-cyan-500/50"
                      }`}
                      placeholder="Minimum 8 characters"
                    />
                    {formErrors.password && (
                      <p className="mt-1 text-xs text-rose-400">{formErrors.password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wider">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={`w-full px-3 py-2.5 bg-black/30 text-sm text-white border rounded-lg focus:outline-none transition-all placeholder:text-slate-600 ${
                        formErrors.confirmPassword
                          ? "border-rose-500/50 focus:border-rose-500"
                          : "border-white/10 focus:border-cyan-500/50"
                      }`}
                      placeholder="Re-enter password"
                    />
                    {formErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-rose-400">{formErrors.confirmPassword}</p>
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
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-cyan-500 text-navy-950 hover:bg-cyan-400 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50"
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

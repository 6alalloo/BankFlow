import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/useAuth";
import {
  FiUsers,
  FiShield,
  FiSearch,
  FiFilter,
  FiEdit2,
  FiPower,
  FiUserPlus,
  FiChevronRight,
  FiLoader,
  FiCheck,
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
import { UserManagementModal } from "./UserManagementModal";
import { initialFormData, type UserFormData } from "./userManagementTypes";

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
      setRoles(data);
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
  };

  const roleStats = useMemo(() => {
    const map = new Map<string, number>();
    roles.forEach((r) => map.set(r.name, 0));
    users.forEach((u) => {
      const count = map.get(u.roles.name) ?? 0;
      map.set(u.roles.name, count + 1);
    });
    return Array.from(map.entries());
  }, [users, roles]);

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
        {roleStats.map(([name, count]) => (
          <div key={name} className="p-3 bg-[#fdfdfd] border border-[#0f1012]/[0.06] rounded-[10px] shadow-card">
            <div className="text-xl font-medium text-[#0f1012] tabular-nums">{count}</div>
            <div className="text-[9px] text-[#868788] uppercase tracking-wider">{name}s</div>
          </div>
        ))}
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
            <p className="text-xs uppercase tracking-widest">Loading Users&hellip;</p>
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

      {showModal && (
        <UserManagementModal
          mode={modalMode}
          selectedUser={selectedUser}
          roles={roles}
          formData={formData}
          formErrors={formErrors}
          submitError={submitError}
          showPasswordChange={showPasswordChange}
          newPassword={newPassword}
          confirmNewPassword={confirmNewPassword}
          passwordError={passwordError}
          isChangingPassword={isChangingPassword}
          isSubmitting={isSubmitting}
          setFormData={setFormData}
          setShowPasswordChange={setShowPasswordChange}
          setNewPassword={setNewPassword}
          setConfirmNewPassword={setConfirmNewPassword}
          resetPasswordChange={() => {
            setShowPasswordChange(false);
            setNewPassword("");
            setConfirmNewPassword("");
            setPasswordError(null);
          }}
          onChangePassword={handleChangePassword}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../../../shared/api/users.api";
import type { User, UserRole } from "../../../shared/types";
import { InputField, SelectField } from "../../../shared/ui/FormField";
import { Alert } from "../../../shared/ui/Alert";
import { RoleBadge } from "../../../shared/ui/Badge";
import { SkeletonTable } from "../../../shared/ui/Skeleton";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Spinner } from "../../../shared/ui/Spinner";
import { formatDate, getApiErrorMessage } from "../../../shared/utils";

const ROLES: UserRole[] = ["APPLICANT", "REVIEWER", "APPROVER", "ADMIN"];

const createUserSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["APPLICANT", "REVIEWER", "APPROVER", "ADMIN"] as const),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

function CreateUserForm({ onSuccess }: { onSuccess: (u: User) => void }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", password: "", role: "APPLICANT" },
  });

  const onSubmit = async (data: CreateUserFormData) => {
    try {
      const user = await usersApi.create(data.email, data.password, data.role);
      reset();
      onSuccess(user);
    } catch (err: unknown) {
      setError("root", { message: getApiErrorMessage(err, "Failed to create user.") });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="card-body form-stack">
        <InputField
          label="Email"
          required
          type="email"
          placeholder="user@bnr.rw"
          error={errors.email}
          {...register("email")}
        />
        <InputField
          label="Password"
          required
          type="password"
          placeholder="Min. 8 characters"
          error={errors.password}
          {...register("password")}
        />
        <SelectField
          label="Role"
          required
          error={errors.role}
          {...register("role")}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </SelectField>
        {errors.root && <Alert variant="error">{errors.root.message}</Alert>}
      </div>
      <div
        className="card-footer flex gap-1"
        style={{ justifyContent: "flex-end" }}
      >
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" light /> Creating…
            </>
          ) : (
            "Create User"
          )}
        </button>
      </div>
    </form>
  );
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersApi.updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const handleCreated = (u: User) => {
    qc.invalidateQueries({ queryKey: ["users"] });
    setShowCreate(false);
    setSuccessMsg(`User ${u.email} created successfully.`);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">
            Manage portal accounts and role assignments
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreate((s) => !s)}
        >
          {showCreate ? "Cancel" : "New User"}
        </button>
      </div>

      {successMsg && (
        <Alert variant="success" className="mb-2">
          {successMsg}
        </Alert>
      )}

      {showCreate && (
        <div className="card mb-2" style={{ maxWidth: 480 }}>
          <div className="card-header">
            <h3>Create User</h3>
          </div>
          <CreateUserForm onSuccess={handleCreated} />
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : users.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Change Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.email}</td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="text-sm text-muted">{formatDate(u.createdAt)}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{
                          width: "auto",
                          fontSize: ".8rem",
                          padding: ".25rem .6rem",
                        }}
                        value={u.role}
                        onChange={(e) =>
                          updateRole({
                            id: u.id,
                            role: e.target.value as UserRole,
                          })
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

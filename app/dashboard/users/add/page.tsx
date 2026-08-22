"use client";

import React from "react";
import { useRouter } from "next/navigation";
import AdminOutletHeading from "@/components/dashboard/AdminOutletHeading";
import { Card } from "@/components/dashboard/ui/Card";
import FormField from "@/components/dashboard/ui/FormField";
import { Input, Select } from "@/components/dashboard/ui/Input";
import Button from "@/components/dashboard/ui/Button";
import { useToast } from "@/components/dashboard/ui/Toast";
import { createUser } from "../actions";
import { isBusinessEmail } from "@/lib/auth-utils";

interface FormState {
  name: string;
  email: string;
  role: string;
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  companyPhone: string;
}

export default function AddUserPage() {
  const router = useRouter();
  const { show } = useToast();
  const [formData, setFormData] = React.useState<FormState>({
    name: "",
    email: "",
    role: "USER",
    companyName: "",
    companyEmail: "",
    companyAddress: "",
    companyPhone: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!formData.name.trim()) next.name = "Full name is required.";
    if (!formData.email.trim()) {
      next.email = "Email is required.";
    } else if (!isBusinessEmail(formData.email)) {
      next.email = "Please use a business email — personal domains are not allowed.";
    }

    if (formData.role === "VENDOR") {
      if (!formData.companyName.trim()) next.companyName = "Company name is required.";
      if (!formData.companyEmail.trim()) next.companyEmail = "Company email is required.";
      if (!formData.companyPhone.trim()) next.companyPhone = "Company phone is required.";
      if (!formData.companyAddress.trim()) next.companyAddress = "Company address is required.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await createUser(formData);
      if (result.success) {
        show(`User created. Temporary password: ${result.tempPassword}`, "success");
        router.push("/dashboard/users");
      } else {
        setFormError(result.error || "Failed to create user");
      }
    } catch (err) {
      console.error(err);
      setFormError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <AdminOutletHeading heading="Add User" subtitle="Create a new user, vendor, or admin account." />

      <Card className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="rounded-xl border border-status-danger/20 bg-status-danger-bg px-4 py-3 text-sm font-medium text-status-danger">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full Name" required error={errors.name}>
              <Input
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={set("name")}
                disabled={isSubmitting}
                error={!!errors.name}
              />
            </FormField>

            <FormField label="Business Email" required error={errors.email}>
              <Input
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={set("email")}
                disabled={isSubmitting}
                error={!!errors.email}
              />
            </FormField>
          </div>

          <FormField label="Access Level" required helperText="Vendors get an additional company profile.">
            <Select value={formData.role} onChange={set("role")} disabled={isSubmitting}>
              <option value="USER">User</option>
              <option value="VENDOR">Vendor</option>
            </Select>
          </FormField>

          {formData.role === "VENDOR" && (
            <div className="space-y-4 border-t border-border-subtle pt-5">
              <h3 className="text-sm font-bold text-primary-navy">Company Details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Company Name" required error={errors.companyName}>
                  <Input
                    placeholder="Acme Corp"
                    value={formData.companyName}
                    onChange={set("companyName")}
                    disabled={isSubmitting}
                    error={!!errors.companyName}
                  />
                </FormField>
                <FormField label="Company Email" required error={errors.companyEmail}>
                  <Input
                    type="email"
                    placeholder="contact@company.com"
                    value={formData.companyEmail}
                    onChange={set("companyEmail")}
                    disabled={isSubmitting}
                    error={!!errors.companyEmail}
                  />
                </FormField>
                <FormField label="Company Phone" required error={errors.companyPhone}>
                  <Input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={formData.companyPhone}
                    onChange={set("companyPhone")}
                    disabled={isSubmitting}
                    error={!!errors.companyPhone}
                  />
                </FormField>
                <FormField label="Company Address" required error={errors.companyAddress}>
                  <Input
                    placeholder="123 Corporate Blvd"
                    value={formData.companyAddress}
                    onChange={set("companyAddress")}
                    disabled={isSubmitting}
                    error={!!errors.companyAddress}
                  />
                </FormField>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => router.push("/dashboard/users")} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create User Account"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

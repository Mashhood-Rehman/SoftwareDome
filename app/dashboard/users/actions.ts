"use server";

import prisma from "@/lib/prisma";
import { isBusinessEmail } from "@/lib/auth-utils";
import { requireAdmin } from "@/lib/require-admin";
import bcrypt from "bcryptjs";

export async function getUsers() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        status: true,
        isEmailVerified: true,
        organizationId: true,
        organization: true,
        companyName: true,
        companyEmail: true,
        companyAddress: true,
        companyPhone: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, data: users };
  } catch (error) {
    console.error("Error fetching users in action:", error);
    return { success: false, error: "Failed to fetch users" };
  }
}

export async function createUser(formData: {
  name: string;
  email: string;
  role: string;
  companyName?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyPhone?: string;
}) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };

    const { name, email, role, companyName, companyEmail, companyAddress, companyPhone } = formData;

    if (!name || !email || !role) {
      return { success: false, error: "All fields are required" };
    }

    if (!isBusinessEmail(email)) {
      return {
        success: false,
        error: "Personal email addresses are not allowed. Please use a business email.",
      };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: "User with this email already exists" };
    }

    // Generate a temporary password (they will change it later)
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role: role as any,
        password: hashedPassword,
        status: "Active",
        companyName: role === "VENDOR" ? companyName : null,
        companyEmail: role === "VENDOR" ? companyEmail : null,
        companyAddress: role === "VENDOR" ? companyAddress : null,
        companyPhone: role === "VENDOR" ? companyPhone : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        status: true,
        isEmailVerified: true,
        organizationId: true,
        companyName: true,
        companyEmail: true,
        companyAddress: true,
        companyPhone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, data: newUser, tempPassword };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: "Failed to create user" };
  }
}

export async function updateUser(
  id: string,
  formData: { name: string; role: string }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };

    const { name, role } = formData;

    if (!name || !role) {
      return { success: false, error: "Name and role are required" };
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name, role: role as any },
    });

    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, error: "Failed to update user" };
  }
}

export async function setUserStatus(id: string, status: "Active" | "Suspended") {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };
    if (auth.session.userId === id) {
      return { success: false, error: "You can't change the status of your own account." };
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
    });
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating user status:", error);
    return { success: false, error: "Failed to update user status" };
  }
}

export async function deleteUser(id: string) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };
    if (auth.session.userId === id) {
      return { success: false, error: "You can't delete your own account." };
    }

    await prisma.user.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}

export async function deleteUsers(ids: string[]) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };

    const targetIds = ids.filter((id) => id !== auth.session.userId);
    if (!targetIds.length) {
      return { success: false, error: "No users selected." };
    }

    const result = await prisma.user.deleteMany({ where: { id: { in: targetIds } } });
    return { success: true, data: { count: result.count } };
  } catch (error) {
    console.error("Error deleting users:", error);
    return { success: false, error: "Failed to delete users" };
  }
}

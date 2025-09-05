import { z } from "zod";

// Journal entry validation schema
export const journalEntrySchema = z.object({
  title: z
    .string()
    .trim()
    .max(200, { message: "Title must be less than 200 characters" })
    .optional()
    .default(""),
  body: z
    .string()
    .trim()
    .min(1, { message: "Entry content is required" })
    .max(50000, { message: "Entry must be less than 50,000 characters" }),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(30, { message: "Tag must be less than 30 characters" })
    )
    .max(20, { message: "Maximum 20 tags allowed" }),
  mood: z.enum(["great", "good", "okay", "poor", "terrible"]),
  date: z.date(),
});

// Tag validation - supports Unicode (Japanese, Chinese, etc.)
export const tagSchema = z
  .string()
  .trim()
  .min(1, { message: "Tag cannot be empty" })
  .max(30, { message: "Tag must be less than 30 characters" })
  .regex(/^[\p{L}\p{N}\s-]+$/u, { 
    message: "Tag can only contain letters, numbers, spaces, and hyphens" 
  });

// Auth validation schemas
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

export const passwordSchema = z
  .string()
  .min(6, { message: "Password must be at least 6 characters" })
  .max(128, { message: "Password must be less than 128 characters" });

export const authSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

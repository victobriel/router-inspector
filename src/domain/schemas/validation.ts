import { z } from "zod";

export const CredentialsSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const WanDataSchema = z.object({
  ppoeUsername: z.string(),
  internetStatus: z.boolean(),
  tr069Status: z.boolean(),
  ipVersion: z.string().nullable(),
  requestPdStatus: z.boolean(),
  slaacStatus: z.boolean(),
  dhcpv6Status: z.boolean(),
  pdStatus: z.boolean(),
  linkSpeed: z.string()
});

export const CollectMessageSchema = z.object({
  action: z.enum(['authenticate', 'collect'], "Invalid action type"),
  credentials: z.object({
    username: z.string(),
    password: z.string()
  })
});

export const ExtractionResultSchema = z.object({
  timestamp: z.string(),
  wan: WanDataSchema.nullable().default(null)
});

export type Credentials = z.infer<typeof CredentialsSchema>;
export type WanData = z.infer<typeof WanDataSchema>;
export type CollectMessage = z.infer<typeof CollectMessageSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export interface IResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ButtonConfig {
  targetSelector: string;
  text: string;
  style: string;
}

export type ValueElement =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | (HTMLElement & { value: string });

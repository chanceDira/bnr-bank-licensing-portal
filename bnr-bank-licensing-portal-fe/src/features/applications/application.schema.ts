import { z } from 'zod';

export const LICENSE_TYPES = [
  'Commercial Bank License',
  'Microfinance Institution License',
  'Savings and Credit Cooperative License',
  'Foreign Bank Branch License',
  'Payment Service Provider License',
  'Development Finance Institution License',
] as const;

export const newApplicationSchema = z.object({
  institutionName: z.string().min(1, 'Institution name is required').max(255),
  licenseType:     z.string().min(1, 'Select a license type'),
  notes:           z.string().max(2000).optional(),
});

export const requestInfoSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const completeReviewSchema = z.object({
  reviewComment: z.string().max(2000).optional(),
});

export const decisionSchema = z.object({
  decision:        z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(2000).optional(),
}).refine(
  d => d.decision !== 'REJECTED' || (d.rejectionReason?.trim().length ?? 0) > 0,
  { message: 'Rejection reason is required when rejecting', path: ['rejectionReason'] },
);

export type NewApplicationFormData = z.infer<typeof newApplicationSchema>;
export type RequestInfoFormData    = z.infer<typeof requestInfoSchema>;
export type CompleteReviewFormData = z.infer<typeof completeReviewSchema>;
export type DecisionFormData       = z.infer<typeof decisionSchema>;

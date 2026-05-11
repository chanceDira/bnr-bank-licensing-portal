import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Application, AuthUser } from '../../../shared/types';
import { WorkflowActions } from './WorkflowActions';

vi.mock('../hooks/useApplication', () => ({
  useApplicationMutations: () => ({
    submit: { mutateAsync: vi.fn(), isPending: false },
    startReview: { mutateAsync: vi.fn(), isPending: false },
    requestInfo: { mutateAsync: vi.fn(), isPending: false },
    resubmit: { mutateAsync: vi.fn(), isPending: false },
    completeReview: { mutateAsync: vi.fn(), isPending: false },
    decide: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

afterEach(() => cleanup());

const baseUser: AuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'APPLICANT',
};

const baseApplication: Application = {
  id: 'app-1',
  applicantId: 'user-1',
  institutionName: 'First Commercial Bank',
  licenseType: 'Commercial Bank License',
  status: 'DRAFT',
  version: 1,
  riskScore: 0,
  riskLevel: 'LOW',
  riskReasons: [],
  createdAt: '2026-05-10T12:00:00.000Z',
  updatedAt: '2026-05-10T12:00:00.000Z',
};

function renderActions(
  appOverrides: Partial<Application>,
  userOverrides: Partial<AuthUser>,
) {
  const app = { ...baseApplication, ...appOverrides };
  const user = { ...baseUser, ...userOverrides };

  return render(<WorkflowActions app={app} user={user} onError={vi.fn()} />);
}

describe('WorkflowActions', () => {
  it('shows submit only to the applicant who owns a draft application', () => {
    renderActions({ status: 'DRAFT', applicantId: 'applicant-1' }, {
      id: 'applicant-1',
      role: 'APPLICANT',
    });

    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start review/i })).not.toBeInTheDocument();
  });

  it('shows review actions only to the assigned reviewer', () => {
    renderActions({ status: 'UNDER_REVIEW', reviewedById: 'reviewer-1' }, {
      id: 'reviewer-1',
      role: 'REVIEWER',
    });

    expect(screen.getByRole('button', { name: /request info/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete review/i })).toBeInTheDocument();
  });

  it('opens a recommendation form before completing review', async () => {
    const user = userEvent.setup();
    renderActions({ status: 'UNDER_REVIEW', reviewedById: 'reviewer-1' }, {
      id: 'reviewer-1',
      role: 'REVIEWER',
    });

    await user.click(screen.getByRole('button', { name: /complete review/i }));

    expect(screen.getByRole('heading', { name: /complete review/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/reviewer recommendation/i)).toBeInTheDocument();
  });

  it('hides final decision from the reviewer who completed the review', () => {
    const { container } = renderActions({ status: 'REVIEW_COMPLETED', reviewedById: 'approver-1' }, {
      id: 'approver-1',
      role: 'APPROVER',
    });

    expect(screen.queryByRole('button', { name: /make decision/i })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows final decision to a different approver', () => {
    renderActions({ status: 'REVIEW_COMPLETED', reviewedById: 'reviewer-1' }, {
      id: 'approver-1',
      role: 'APPROVER',
    });

    expect(screen.getByRole('button', { name: /make decision/i })).toBeInTheDocument();
  });
});

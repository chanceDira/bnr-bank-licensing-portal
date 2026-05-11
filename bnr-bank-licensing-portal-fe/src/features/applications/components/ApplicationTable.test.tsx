import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../shared/types';
import { ApplicationTable } from './ApplicationTable';

const app: Application = {
  id: 'app-1',
  applicantId: 'applicant-1',
  institutionName: 'First Commercial Bank',
  licenseType: 'Commercial Bank License',
  status: 'SUBMITTED',
  version: 1,
  riskScore: 85,
  riskLevel: 'HIGH',
  riskReasons: ['No supporting documents uploaded'],
  createdAt: '2026-05-10T12:00:00.000Z',
  updatedAt: '2026-05-10T12:00:00.000Z',
};

describe('ApplicationTable', () => {
  it('renders risk level and score when requested', () => {
    render(
      <MemoryRouter>
        <ApplicationTable items={[app]} isLoading={false} showRisk />
      </MemoryRouter>,
    );

    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });
});

import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi } from '../../../shared/api/applications.api';
import { newApplicationSchema, type NewApplicationFormData } from '../application.schema';
import { useLicenseTypesStore } from '../../admin/licenseTypes.store';
import { APPLICATIONS_KEY } from '../hooks/useApplications';
import { InputField, TextareaField, SelectField } from '../../../shared/ui/FormField';
import { Alert } from '../../../shared/ui/Alert';
import { Spinner } from '../../../shared/ui/Spinner';

export default function NewApplicationPage() {
  const licenseTypes = useLicenseTypesStore(s => s.types);
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewApplicationFormData>({
    resolver: zodResolver(newApplicationSchema),
    defaultValues: { institutionName: '', licenseType: '', notes: '' },
  });

  const notes = watch('notes') ?? '';

  const { mutateAsync: createApp } = useMutation({
    mutationFn: applicationsApi.create,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [APPLICATIONS_KEY] }),
  });

  const onSubmit = async (data: NewApplicationFormData) => {
    try {
      const app = await createApp({
        institutionName: data.institutionName,
        licenseType:     data.licenseType,
        notes:           data.notes || undefined,
      });
      navigate(`/applications/${app.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to create application.';
      setError('root', { message: msg });
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Application</h1>
          <p className="page-subtitle">Submit a new bank licensing application to the National Bank of Rwanda</p>
        </div>
        <Link to="/applications" className="btn btn-outline">← Back</Link>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header"><h3>Application Details</h3></div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="card-body form-stack">
            <InputField
              label="Institution name"
              required
              type="text"
              placeholder="e.g. First Commercial Bank Rwanda Ltd"
              error={errors.institutionName}
              {...register('institutionName')}
            />

            <SelectField
              label="License type"
              required
              error={errors.licenseType}
              {...register('licenseType')}
            >
              <option value="">Select license type…</option>
              {licenseTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </SelectField>

            <TextareaField
              label="Additional notes"
              placeholder="Provide any relevant context about your institution or this application…"
              hint={`${notes.length}/2000 characters`}
              error={errors.notes}
              {...register('notes')}
            />

            {errors.root && <Alert variant="error">{errors.root.message}</Alert>}
          </div>

          <div className="card-footer flex gap-1" style={{ justifyContent: 'flex-end' }}>
            <Link to="/applications" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <><Spinner size="sm" light /> Saving…</> : 'Create application'}
            </button>
          </div>
        </form>
      </div>

      <Alert variant="info" className="mt-3" style={{ maxWidth: 640 }}>
        Application is saved as a <strong>Draft</strong>.
        Upload supporting documents on the next screen, then submit for review.
      </Alert>
    </>
  );
}

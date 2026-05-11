import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLicenseTypesStore } from '../licenseTypes.store';
import { InputField } from '../../../shared/ui/FormField';
import { Alert } from '../../../shared/ui/Alert';

const labelSchema = z.object({
  label: z.string().min(1, 'Required').max(120, 'Max 120 characters'),
});
type LabelForm = z.infer<typeof labelSchema>;

function AddForm({ onAdd }: { onAdd: (label: string) => string | null }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LabelForm>({
    resolver: zodResolver(labelSchema),
    defaultValues: { label: '' },
  });

  const onSubmit = (data: LabelForm) => {
    const err = onAdd(data.label);
    if (err) { setError('label', { message: err }); return; }
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <InputField
          label="New license type"
          placeholder="e.g. Islamic Banking License"
          error={errors.label}
          {...register('label')}
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={isSubmitting}
        style={{ marginTop: '1.6rem', flexShrink: 0 }}
      >
        Add
      </button>
    </form>
  );
}

function EditRow({ value, onSave, onCancel, onRemove }: {
  value: string;
  onSave: (next: string) => string | null;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LabelForm>({
    resolver: zodResolver(labelSchema),
    defaultValues: { label: value },
  });

  const onSubmit = (data: LabelForm) => {
    const err = onSave(data.label);
    if (err) { setError('label', { message: err }); return; }
  };

  return (
    <tr>
      <td colSpan={2} style={{ padding: '.5rem .85rem' }}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <InputField label="Edit" error={errors.label} {...register('label')} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: '1.6rem' }}>Save</button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '1.6rem' }} onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: '1.6rem' }} onClick={onRemove}>Remove</button>
        </form>
      </td>
    </tr>
  );
}

export default function AdminSettingsPage() {
  const { types, add, update, remove } = useLicenseTypesStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const handleAdd = (label: string): string | null => {
    if (types.includes(label.trim())) return 'License type already exists.';
    add(label);
    return null;
  };

  const handleUpdate = (old: string, next: string): string | null => {
    const trimmed = next.trim();
    if (trimmed !== old && types.includes(trimmed)) return 'License type already exists.';
    update(old, next);
    setEditing(null);
    return null;
  };

  const handleRemove = (label: string) => {
    remove(label);
    setEditing(null);
    setRemoveConfirm(null);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage license type categories available to applicants</p>
        </div>
      </div>

      <Alert variant="info" className="mb-2">
        Changes take effect immediately. Existing applications retain their original license type label.
      </Alert>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header">
          <h3>License Types</h3>
          <span className="text-sm text-muted">{types.length} type{types.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 && (
                <tr><td colSpan={2} className="text-muted text-sm" style={{ textAlign: 'center', padding: '2rem' }}>
                  No license types defined.
                </td></tr>
              )}
              {types.map(t => (
                editing === t ? (
                  <EditRow
                    key={t}
                    value={t}
                    onSave={(next) => handleUpdate(t, next)}
                    onCancel={() => setEditing(null)}
                    onRemove={() => setRemoveConfirm(t)}
                  />
                ) : (
                  <tr key={t}>
                    <td className="font-semibold">{t}</td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => { setEditing(t); setRemoveConfirm(null); }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>

        <div className="card-footer">
          <AddForm onAdd={handleAdd} />
        </div>
      </div>

      {/* Remove confirmation modal */}
      {removeConfirm && (
        <div className="modal-backdrop" onClick={() => setRemoveConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove License Type</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setRemoveConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <Alert variant="warning">
                Remove <strong>"{removeConfirm}"</strong>? Existing applications using this type are unaffected.
              </Alert>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRemoveConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleRemove(removeConfirm)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

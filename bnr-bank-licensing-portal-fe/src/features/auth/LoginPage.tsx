import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from './auth.store';
import { loginSchema, type LoginFormData } from './auth.schema';
import { InputField } from '../../shared/ui/FormField';
import { Spinner } from '../../shared/ui/Spinner';
import { Alert } from '../../shared/ui/Alert';

export default function LoginPage() {
  const navigate  = useNavigate();
  const { user, login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (user) navigate('/applications', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      navigate('/applications', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Invalid email or password.';
      setError('root', { message: msg });
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-mark">
          <img src="/bnr__logo.jpeg" alt="BNR Logo" width={50} height={50} />
          </div>
          <div>
            <div className="login-logo-title">BNR Licensing Portal</div>
            <div className="login-logo-sub">National Bank of Rwanda</div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="form-stack" noValidate>
          <InputField
            label="Email address"
            required
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@bnr.rw"
            error={errors.email}
            {...register('email')}
          />
          <InputField
            label="Password"
            required
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password}
            {...register('password')}
          />

          {errors.root && (
            <Alert variant="error">{errors.root.message}</Alert>
          )}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
            {isSubmitting ? <><Spinner size="sm" light /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-muted mt-3" style={{ textAlign: 'center' }}>
          Restricted system — authorised personnel only
        </p>
      </div>
    </div>
  );
}

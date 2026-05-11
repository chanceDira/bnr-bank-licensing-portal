const KEY = 'bnr-token';

const _token = { value: localStorage.getItem(KEY) };

export const tokenStore = {
  get: (): string | null => _token.value,
  set: (t: string | null): void => {
    _token.value = t;
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  },
};

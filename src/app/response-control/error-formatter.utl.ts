export function formatBackendErrorPayload(rawError: any): string {
    if (!rawError) {
      return 'No se pudo establecer comunicación con el servidor. Inténtalo de nuevo.';
    }

    const payload = rawError?.error ?? rawError;

    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        return payload.errors
          .map((item: any) => {
            const prop = item.propertyName || item.property || item.field || '';
            const msg = item.errorMessage || item.message || item.description || '';
            return prop ? `${prop}: ${msg}` : msg;
          })
          .filter(Boolean)
          .join(' | ');
      }

      if (payload.message && typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
      }

      if (payload.title || payload.detail) {
        return [payload.title, payload.detail].filter(Boolean).join(': ');
      }

      if (payload.name && payload.name !== 'HttpErrorResponse') {
        return payload.name;
      }
    }

    if (typeof rawError.message === 'string' && rawError.message.trim()) {
      return rawError.message;
    }

    if (typeof rawError === 'string' && rawError.trim()) {
      return rawError;
    }

    return 'Ocurrió un error al procesar la solicitud. Revisa los datos e inténtalo de nuevo.';
  }

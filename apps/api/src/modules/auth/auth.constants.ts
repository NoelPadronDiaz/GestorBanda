import { API_PREFIX } from '../../app.constants';

export const JWT_ISSUER = 'alcaravan-api';
export const REFRESH_COOKIE_NAME = 'refresh_token';
/** La cookie solo viaja a los endpoints de auth, no a toda la API. */
export const REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`;

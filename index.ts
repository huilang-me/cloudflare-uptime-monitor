import { onRequest } from './functions/fetch';
import { onScheduled } from './functions/scheduled';

export default {
  fetch: onRequest,
  scheduled: onScheduled
};

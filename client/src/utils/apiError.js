export const apiErrorMessage = (error, fallback) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === 'ECONNABORTED') {
    return 'The server took too long to respond. Check that MongoDB finished starting.';
  }

  if (!error.response) {
    return 'Cannot reach the API. In a second terminal run npm run dev inside the server folder.';
  }

  return fallback;
};

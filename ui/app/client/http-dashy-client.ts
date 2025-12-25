import Axios, { type AxiosRequestConfig } from "axios";
import { getAccessToken, clearTokens } from "@/lib/auth";
import { toast } from "sonner";

export const DATA_SERVICE_BASE_URL =
  import.meta.env.VITE_DEV_MODE === "true"
    ? "http://localhost:8000/"
    : import.meta.env.VITE_DATA_SERVICE_BASE_URL;

export const AXIOS_INSTANCE = Axios.create({
  baseURL: DATA_SERVICE_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

AXIOS_INSTANCE.interceptors.request.use(async function (config) {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const messages =
      error.response?.data?.messages || error.response?.data?.detail;

    if (status === 400) {
      if (messages) {
        toast.error(Array.isArray(messages) ? messages.join(", ") : messages);
      }
    }
    if (status === 401) {
      clearTokens();
      window.location.href = "/login";
    }
    if (status === 403) {
      if (messages) {
        toast.error(Array.isArray(messages) ? messages.join(", ") : messages);
      } else {
        toast.error("You do not have permission to perform this action");
      }
    }
    if (status === 404) {
      if (messages) {
        toast.error(Array.isArray(messages) ? messages.join(", ") : messages);
      }
    }
    if (status === 500) {
      toast.error("An unexpected error occurred. Please try again.");
    }

    return Promise.reject(error);
  }
);

export const httpDashyClient = async <T>(
  config: AxiosRequestConfig
): Promise<T> => {
  const { data } = await AXIOS_INSTANCE(config);
  return data;
};

export default httpDashyClient;

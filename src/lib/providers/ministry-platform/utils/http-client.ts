import { QueryParams, RequestBody } from "../types/provider.types";
import { logger } from "./logger";

export class HttpClient {
    private baseUrl: string;
    private getToken: () => string;

    constructor(baseUrl: string, getToken: () => string) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }

    /**
     * Shared error-handling for non-2xx responses.
     *
     * Logs and throws IDENTIFIERS AND SHAPE ONLY — method, endpoint, status,
     * statusText. Deliberately NOT the response body and NOT the full URL:
     *
     *  - The body of a failed MP request routinely echoes back record content
     *    (names, emails, notes) and the `$filter` string that produced it.
     *  - `endpoint` is the path only; the query string carries the `$filter`.
     *  - A thrown message propagates much further than a log line — into error
     *    reporters, client-visible action results and, previously, into every
     *    downstream log that stringified the error. Appending the body there
     *    leaked it everywhere at once.
     *
     * All HTTP methods (GET/POST/POST FormData/PUT/PUT FormData/DELETE) route
     * through this helper so callers get the same shape of error regardless of
     * method.
     */
    private async handleFailedResponse(
        method: string,
        endpoint: string,
        response: Response
    ): Promise<never> {
        logger.error('mp.request.failed', {
            method,
            endpoint,
            status: response.status,
            statusText: response.statusText,
        });
        throw new Error(
            `${method} ${endpoint} failed: ${response.status} ${response.statusText}`
        );
    }

    async get<T = unknown>(endpoint: string, queryParams?: QueryParams): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            await this.handleFailedResponse('GET', endpoint, response);
        }

        return await response.json() as T;
    }

    async post<T = unknown>(endpoint: string, body?: RequestBody, queryParams?: QueryParams): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            await this.handleFailedResponse('POST', endpoint, response);
        }

        return await response.json() as T;
    }

    async postFormData<T = unknown>(endpoint: string, formData: FormData, queryParams?: QueryParams): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
                'Accept': 'application/json'
                // Don't set Content-Type for FormData
            },
            body: formData
        });

        if (!response.ok) {
            await this.handleFailedResponse('POST', endpoint, response);
        }

        return await response.json() as T;
    }

    async put<T = unknown>(endpoint: string, body: RequestBody, queryParams?: QueryParams): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);


        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            await this.handleFailedResponse('PUT', endpoint, response);
        }

        return await response.json() as T;
    }

    async putFormData<T = unknown>(endpoint: string, formData: FormData, queryParams?: QueryParams): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
                'Accept': 'application/json'
                // Don't set Content-Type for FormData
            },
            body: formData
        });

        if (!response.ok) {
            await this.handleFailedResponse('PUT', endpoint, response);
        }

        return await response.json() as T;
    }

    async delete<T = unknown>(endpoint: string, queryParams?: QueryParams): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            await this.handleFailedResponse('DELETE', endpoint, response);
        }

        return await response.json() as T;
    }

    public buildUrl(endpoint: string, queryParams?: QueryParams): string {
        const url = `${this.baseUrl}${endpoint}`;
        if (!queryParams) return url;

        const queryString = this.buildQueryString(queryParams);
        return queryString ? `${url}?${queryString}` : url;
    }

    private buildQueryString(params: QueryParams): string {
        return Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    return value.map(v => `${key}=${encodeURIComponent(String(v))}`).join('&');
                }
                return `${key}=${encodeURIComponent(String(value))}`;
            })
            .join('&');
    }
}
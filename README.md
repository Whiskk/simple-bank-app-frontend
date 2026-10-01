# Simple Bank App Frontend

React 19 and Vite 8 frontend for the [Bank App API](../bankapp-api-java-backend/README.md). The backend and frontend are separate repositories and run in separate terminals.

## Run Locally

Install Node.js and npm, and start the backend first. The backend requires a working MongoDB connection; see its [setup instructions](../bankapp-api-java-backend/README.md#run-locally). From this directory:

```powershell
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. Keep both terminals running. Vite proxies `/api` requests to `http://localhost:8080` (see `vite.config.js`). If the backend is stopped, sign-in and account requests will fail. Opening the backend root URL does not show the frontend.

## What You Can Do

- Register a customer or sign in. Customer and admin sign-in use separate buttons and backend login endpoints; registering does not grant admin access.
- Customers see only their own accounts. They can open Savings or Checking accounts, transfer between their accounts when funds are available, and delete an account only when its balance is zero.
- Customers can edit their name, username, and password from **Edit profile**. Changing a username or password requires the current password; a new password must be entered twice and match. Changing a password signs the customer out.
- Admins see all non-admin customers, expand each customer's account list, and add or delete accounts for that customer. Account deletion requires a zero balance.

The backend enforces ownership and admin permissions; disabled buttons and dialogs are additional UI safeguards. The JWT is stored in browser `sessionStorage` for that tab and removed on sign-out. Existing tokens are not revoked on the server until they expire.

## Checks

```powershell
npm run lint
npm run build
```

The backend has Maven tests and a [Postman collection](../bankapp-api-java-backend/postman/william-rowley-simple-bank-app.postman_collection.json) for API workflows. See the backend README for its test instructions and security limitations.

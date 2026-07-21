# SSHS 108

The production service is currently implemented with Flask in `app.py`.

The TypeScript migration is being developed in [`web/`](web/README.md) with Next.js, MongoDB, and Vercel as the deployment target. The Flask application is retained during the migration so the existing PythonAnywhere service can continue operating until the cutover is verified.

Secrets must be supplied through environment variables. Never commit OAuth client secrets, database credentials, session secrets, or exported production data.

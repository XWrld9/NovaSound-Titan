FROM ghcr.io/muchdogesec/pocketbase:latest

# Copier les fichiers de configuration et hooks
COPY ./pb_hooks /pb_hooks
COPY ./pb_migrations /pb_migrations

# Exposer le port
EXPOSE 8080

# Démarrer PocketBase
CMD ["/pocketbase", "serve", "--http=0.0.0.0:8080"]

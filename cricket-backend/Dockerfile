FROM alpine:latest

# Install dependencies
RUN apk add --no-cache unzip ca-certificates curl

# Download pocketbase Linux binary (v0.39.4)
ADD https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && rm /tmp/pb.zip

# Copy built frontend public files into the image
COPY ./pb_public /pb/pb_public

# Copy database migrations if they exist
COPY ./pb_migrations /pb/pb_migrations

# Expose pocketbase default HTTP port
EXPOSE 8090

# Start pocketbase serving from the pb_data volume mount
CMD ["/pb/pocketbase", "serve", "--http", "0.0.0.0:8090", "--dir", "/pb/pb_data"]

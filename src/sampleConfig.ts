export const sampleConfig = `# configuration file /etc/nginx/nginx.conf:
worker_processes auto;

events {
  worker_connections 1024;
}

http {
  map $host $backend {
    default app_pool;
    api.example.com api_pool;
  }

  upstream app_pool {
    server 10.0.0.11:8080;
    server 10.0.0.12:8080 weight=2;
  }

  upstream api_pool {
    server unix:/run/api.sock;
  }

  server {
    listen 80;
    listen 443 ssl http2;
    server_name example.com api.example.com;

    location / {
      proxy_pass http://app_pool;
    }

    location /api {
      rewrite ^/api/(.*)$ /$1 break;
      proxy_pass http://$backend;
    }

    location /grpc {
      grpc_pass grpc://api_pool;
    }

    return 301 https://$host$request_uri;
  }
}

stream {
  upstream tcp_pool {
    server 127.0.0.1:9000;
  }

  server {
    listen 9001;
    proxy_pass tcp_pool;
  }
}
`;

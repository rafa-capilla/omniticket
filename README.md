# OmniTicket

## Requisitos
- Docker
- Docker Compose

## Instalación

### Primera vez
```bash
docker-compose run --rm omniticket npm install
docker-compose up
```

### Ejecución normal
```bash
docker-compose up
```

### Si agregas/actualizas dependencias
```bash
docker-compose run --rm omniticket npm install
docker-compose restart
```

## Acceso
http://localhost:5173
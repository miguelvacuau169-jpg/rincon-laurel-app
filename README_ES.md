# 🍽️ El Rincón del Laurel - Sistema de Gestión de Pedidos

Aplicación móvil interna para gestión de pedidos en tiempo real para el restaurante El Rincón del Laurel.

## 📱 Características Principales

### ✨ Funcionalidades Core
- **Gestión de Pedidos en Tiempo Real**: Sincronización instantánea entre todos los dispositivos usando WebSockets
- **Sistema de Roles**: 3 usuarios (Barra, Camarero 1, Camarero 2)
- **Modo Offline**: Funcionamiento sin conexión con sincronización automática
- **Notificaciones Push**: Alertas cuando los pedidos están listos (integración OneSignal)
- **Unificación Inteligente**: Pedidos creados en menos de 3 minutos con productos similares se agrupan automáticamente

### 🎯 Gestión de Pedidos
- Crear pedidos por número de mesa
- Agregar múltiples productos con cantidades
- Notas especiales por producto y por pedido
- Estados del pedido: Pendiente → En Preparación → Listo → Entregado
- Filtros por estado de pedido
- Vista detallada de cada pedido
- Edición y eliminación de pedidos

### 💰 Sistema de Pagos
- Formas de cobro: Efectivo, Tarjeta, o Ambos (pago mixto)
- Cobros parciales (algunos clientes pagan su parte)
- Cálculo automático de totales

### 📋 Gestión de Productos
- CRUD completo de productos
- Categorías: Comidas, Bebidas, Postres
- Carga de datos de ejemplo con menú español típico
- Edición de precios en tiempo real

### ⚙️ Configuración
- Integración OneSignal (App ID y API Key)
- Cambio de rol sin cerrar sesión
- Interfaz de configuración intuitiva

## 🎨 Diseño

**Paleta de colores corporativa extraída del logo:**
- 🟤 Marrón Principal: `#6B5149`
- 🌊 Verde Turquesa: `#2D7A6B`
- 🟡 Dorado: `#D4AF37`
- 🟡 Beige/Crema: `#F5E6D3`
- 🟢 Verde Oliva: `#6B7A3E`

**UI/UX:**
- Interfaz móvil optimizada con diseño thumb-friendly
- Navegación por tabs para acceso rápido
- Modales deslizables para detalles
- Feedback háptico en acciones importantes
- Indicadores visuales de estado

## 🏗️ Arquitectura Técnica

### Backend (FastAPI + MongoDB + Socket.IO)
```
/app/backend/
├── server.py              # API REST + WebSocket server
└── requirements.txt       # Dependencias Python
```

**Stack:**
- FastAPI: Framework web asíncrono
- Motor: Driver MongoDB asíncrono
- Python Socket.IO: Comunicación en tiempo real
- Pydantic: Validación de datos

**API Endpoints:**
- `GET /api/products` - Listar productos
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto
- `GET /api/orders` - Listar pedidos
- `POST /api/orders` - Crear pedido
- `PUT /api/orders/:id` - Actualizar pedido
- `DELETE /api/orders/:id` - Eliminar pedido
- `GET /api/settings` - Obtener configuración
- `PUT /api/settings` - Actualizar configuración
- `POST /api/seed` - Cargar datos de ejemplo

**Socket.IO Events:**
- `connect` - Conexión establecida
- `set_role` - Asignar rol al usuario
- `sync_request` - Solicitar sincronización completa
- `order_created` - Nuevo pedido creado
- `order_updated` - Pedido actualizado
- `order_deleted` - Pedido eliminado
- `product_created` - Producto creado
- `product_updated` - Producto actualizado
- `product_deleted` - Producto eliminado
- `notification` - Notificación push

### Frontend (Expo + React Native)
```
/app/frontend/
├── app/
│   ├── _layout.tsx                # Layout principal
│   ├── index.tsx                  # Splash screen
│   ├── role-selection.tsx         # Selección de rol
│   └── (tabs)/
│       ├── _layout.tsx            # Layout de tabs
│       ├── index.tsx              # Lista de pedidos
│       ├── new-order.tsx          # Crear nuevo pedido
│       ├── products.tsx           # Gestión de productos
│       └── settings.tsx           # Configuración
├── context/
│   └── AppContext.tsx             # Estado global de la app
├── services/
│   └── api.ts                     # API client + Socket.IO
├── constants/
│   └── Colors.ts                  # Paleta de colores
└── assets/
    └── images/
        └── logo.png               # Logo del restaurante
```

**Stack:**
- Expo Router: Navegación basada en archivos
- React Native: UI móvil nativa
- Socket.IO Client: Tiempo real
- AsyncStorage: Almacenamiento offline
- Expo Haptics: Feedback táctil
- React Native Modal: Modales deslizables
- Date-fns: Manejo de fechas

## 🚀 Cómo Usar

### Inicio de Sesión
1. Abre la app (verás el splash screen con el logo)
2. Selecciona tu rol: Barra, Camarero 1, o Camarero 2
3. Serás redirigido a la pantalla principal de pedidos

### Crear un Pedido
1. Ve a la tab "Nuevo Pedido"
2. Ingresa el número de mesa
3. Selecciona productos del menú (por categoría)
4. Ajusta cantidades con los botones + / -
5. Agrega notas especiales a cada producto si es necesario
6. Agrega nota general del pedido (opcional)
7. Presiona "Crear Pedido"

### Ver y Gestionar Pedidos
1. En la tab "Pedidos", verás todos los pedidos ordenados por hora
2. Filtra por estado: Todos, Pendiente, En Preparación, Listo, Entregado
3. Toca un pedido para ver detalles
4. Cambia el estado del pedido con los botones
5. Cuando un pedido pasa a "Listo", el camarero recibe una notificación

### Gestionar Productos
1. Ve a la tab "Productos"
2. Si no hay productos, presiona "Cargar Datos" para cargar el menú de ejemplo
3. Presiona "Nuevo" para agregar un producto
4. Edita o elimina productos existentes

### Configurar OneSignal
1. Ve a la tab "Configuración"
2. Ingresa tu OneSignal App ID
3. Ingresa tu OneSignal API Key
4. Presiona "Guardar Configuración"

### Cambiar de Rol
1. Ve a la tab "Configuración"
2. Presiona "Cambiar" junto a tu rol actual
3. Confirma el cambio
4. Selecciona tu nuevo rol

## 🔧 Instalación y Desarrollo

### Requisitos Previos
- Node.js 18+
- Python 3.11+
- MongoDB
- Yarn

### Configuración del Backend
```bash
cd /app/backend
pip install -r requirements.txt
uvicorn server:socket_app --host 0.0.0.0 --port 8001 --reload
```

### Configuración del Frontend
```bash
cd /app/frontend
yarn install
yarn start
```

### Variables de Entorno

**Backend (`.env`):**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=rincon_laurel
```

**Frontend (`.env`):**
```
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com
```

## 📊 Flujo de Datos

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Camarero  │         │   Backend   │         │   Barra     │
│     App     │◄───────►│  Socket.IO  │◄───────►│    App      │
└─────────────┘         └─────────────┘         └─────────────┘
      │                        │                        │
      │                        │                        │
      │                        ▼                        │
      │                  ┌──────────┐                   │
      └─────────────────►│ MongoDB  │◄──────────────────┘
                         └──────────┘
```

## 🎯 Características Técnicas Especiales

### Sincronización en Tiempo Real
- Todos los cambios se propagan instantáneamente a todos los clientes conectados
- Reconexión automática en caso de pérdida de conexión
- Sincronización completa al reconectar

### Modo Offline
- Los datos se guardan localmente con AsyncStorage
- Las operaciones se encolan para ejecutarse al reconectar
- La app sigue siendo usable sin conexión

### Unificación de Pedidos
- El sistema detecta automáticamente pedidos similares creados en un intervalo de 3 minutos
- Los productos idénticos se agrupan para preparación conjunta
- Mantiene la información de mesa y camarero de cada parte

### Notificaciones
- Vibración y sonido cuando llega un nuevo pedido
- Notificación push cuando un pedido pasa a estado "Listo"
- Solo recibe notificaciones el camarero asignado al pedido

## 🛠️ Datos de Ejemplo

El menú incluye productos típicos españoles:

**Comidas:**
- Paella Valenciana (€15.50)
- Tortilla Española (€8.00)
- Jamón Ibérico (€18.00)
- Croquetas Caseras (€9.50)
- Pulpo a la Gallega (€16.00)

**Bebidas:**
- Vino Tinto Rioja (€3.50)
- Cerveza Estrella (€2.50)
- Agua Mineral (€1.50)
- Sangría (€4.00)
- Café Solo (€1.20)

**Postres:**
- Tarta de Santiago (€5.50)
- Flan Casero (€4.50)
- Churros con Chocolate (€6.00)
- Helado Artesano (€4.00)

## 📝 Notas Importantes

1. **OneSignal**: Para recibir notificaciones push, debes configurar una cuenta en OneSignal y agregar las credenciales en la app
2. **Conexión Internet**: La app funciona offline pero requiere conexión para sincronizar cambios
3. **Roles**: El rol se guarda localmente, no requiere autenticación compleja
4. **MongoDB**: Asegúrate de que MongoDB esté corriendo antes de iniciar el backend

## 🎉 ¡Listo para Usar!

La aplicación está completamente funcional y lista para ser usada en el restaurante El Rincón del Laurel. Todos los empleados pueden empezar a gestionar pedidos inmediatamente desde sus dispositivos Android.

## 📧 Soporte

Para cualquier problema o sugerencia, contacta al equipo de desarrollo.

---

**Desarrollado con ❤️ para El Rincón del Laurel**

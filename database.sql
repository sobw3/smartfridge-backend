-- Tabela para armazenar os condomínios
CREATE TABLE condominiums (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    syndic_name VARCHAR(255),
    syndic_contact VARCHAR(255),
    syndic_profit_percentage NUMERIC(5, 2) DEFAULT 0.00,
    initial_investment NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para armazenar os utilizadores
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    birth_date DATE,
    condo_id INTEGER REFERENCES condominiums(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de catálogo de produtos
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    purchase_price NUMERIC(10, 2) NOT NULL,
    sale_price NUMERIC(10, 2) NOT NULL,
    critical_stock_level INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de inventário para ligar produtos aos condomínios
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    condo_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, condo_id)
);

-- Tabela de pedidos
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    condo_id INTEGER NOT NULL REFERENCES condominiums(id),
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- ex: pending, paid, failed
    payment_gateway_id VARCHAR(255), -- ID do pagamento no Mercado Pago
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de itens de um pedido
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price_at_purchase NUMERIC(10, 2) NOT NULL
);

-- Tabela para os tokens de desbloqueio da geladeira
CREATE TABLE unlock_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

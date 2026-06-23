-- =================================================================================
-- Script de Creación de Tablas para Microsoft SQL Server (T-SQL)
-- Generado a partir de prisma/schema.prisma
-- =================================================================================

-- 1. Tabla de Usuarios
CREATE TABLE [User] (
    [id] NVARCHAR(36) NOT NULL DEFAULT (LOWER(CAST(NEWID() AS VARCHAR(36)))),
    [username] NVARCHAR(256) NOT NULL,
    [password] NVARCHAR(256) NOT NULL,
    [role] NVARCHAR(50) NOT NULL DEFAULT 'user',
    [createdAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_User] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [UQ_User_username] UNIQUE ([username] ASC)
);

-- 2. Tabla de Tiendas (Stores)
CREATE TABLE [Store] (
    [id] NVARCHAR(36) NOT NULL DEFAULT (LOWER(CAST(NEWID() AS VARCHAR(36)))),
    [name] NVARCHAR(256) NOT NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_Store] PRIMARY KEY CLUSTERED ([id] ASC)
);

-- 3. Tabla de Productos (Product Catalog)
CREATE TABLE [Product] (
    [id] NVARCHAR(36) NOT NULL DEFAULT (LOWER(CAST(NEWID() AS VARCHAR(36)))),
    [sku] NVARCHAR(100) NOT NULL,
    [name] NVARCHAR(256) NOT NULL,
    [brand] NVARCHAR(256) NULL,
    [department] NVARCHAR(256) NULL,
    [subcategory] NVARCHAR(256) NULL,
    [providerCode] NVARCHAR(100) NULL,
    [provider] NVARCHAR(256) NULL,
    [width] FLOAT NOT NULL,
    [height] FLOAT NOT NULL,
    [depth] FLOAT NOT NULL,
    [price] FLOAT NOT NULL,
    [color] NVARCHAR(50) NOT NULL,
    [category] NVARCHAR(256) NOT NULL,
    CONSTRAINT [PK_Product] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [UQ_Product_sku] UNIQUE ([sku] ASC)
);

-- 4. Tabla de Góndolas (Mobiliario Comercial)
CREATE TABLE [Gondola] (
    [id] NVARCHAR(36) NOT NULL DEFAULT (LOWER(CAST(NEWID() AS VARCHAR(36)))),
    [name] NVARCHAR(256) NOT NULL,
    [aisle] NVARCHAR(100) NULL,
    [category] NVARCHAR(256) NULL,
    [description] NVARCHAR(1000) NULL,
    [type] NVARCHAR(50) NOT NULL, -- 'pared', 'central', 'cabecera', 'refrigerado'
    [width] FLOAT NOT NULL,
    [height] FLOAT NOT NULL,
    [depth] FLOAT NOT NULL,
    [numShelves] INT NOT NULL,
    [gapBetweenShelves] FLOAT NOT NULL,
    [baseHeight] FLOAT NOT NULL,
    [shelfThickness] FLOAT NOT NULL,
    [shelfDepth] FLOAT NOT NULL,
    [shelfWidth] FLOAT NOT NULL,
    [autoPack] BIT NOT NULL DEFAULT 1,
    [storeId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [PK_Gondola] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_Gondola_Store] FOREIGN KEY ([storeId]) 
        REFERENCES [Store] ([id]) ON DELETE CASCADE
);

-- 5. Tabla de Estantes (Shelves)
CREATE TABLE [Shelf] (
    [id] NVARCHAR(36) NOT NULL DEFAULT (LOWER(CAST(NEWID() AS VARCHAR(36)))),
    [index] INT NOT NULL,
    [y] FLOAT NOT NULL,
    [type] NVARCHAR(50) NOT NULL, -- 'plancha', 'perchero'
    [hookSpacing] FLOAT NULL,
    [depth] FLOAT NOT NULL,
    [gondolaId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [PK_Shelf] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_Shelf_Gondola] FOREIGN KEY ([gondolaId]) 
        REFERENCES [Gondola] ([id]) ON DELETE CASCADE
);

-- 6. Tabla de Ubicación de Productos (Product Placements)
CREATE TABLE [ProductPlacement] (
    [id] NVARCHAR(36) NOT NULL DEFAULT (LOWER(CAST(NEWID() AS VARCHAR(36)))),
    [x] FLOAT NOT NULL,
    [hookIndex] INT NULL,
    [placedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [shelfId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [PK_ProductPlacement] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_ProductPlacement_Shelf] FOREIGN KEY ([shelfId]) 
        REFERENCES [Shelf] ([id]) ON DELETE CASCADE
);

-- 7. Tabla de Niveles/Capas de Producto (Product Layers/Stacking)
CREATE TABLE [ProductLayer] (
    [id] NVARCHAR(36) NOT NULL DEFAULT (LOWER(CAST(NEWID() AS VARCHAR(36)))),
    [index] INT NOT NULL, -- Stack order (0 = base, 1 = layer 1, etc.)
    [facings] INT NOT NULL DEFAULT 1,
    [orientation] INT NOT NULL DEFAULT 0,
    [placementId] NVARCHAR(36) NOT NULL,
    [productId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [PK_ProductLayer] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_ProductLayer_ProductPlacement] FOREIGN KEY ([placementId]) 
        REFERENCES [ProductPlacement] ([id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ProductLayer_Product] FOREIGN KEY ([productId]) 
        REFERENCES [Product] ([id])
);

-- Índices de rendimiento recomendados
CREATE NONCLUSTERED INDEX [IX_Gondola_storeId] ON [Gondola]([storeId] ASC);
CREATE NONCLUSTERED INDEX [IX_Shelf_gondolaId] ON [Shelf]([gondolaId] ASC);
CREATE NONCLUSTERED INDEX [IX_ProductPlacement_shelfId] ON [ProductPlacement]([shelfId] ASC);
CREATE NONCLUSTERED INDEX [IX_ProductLayer_placementId] ON [ProductLayer]([placementId] ASC);
CREATE NONCLUSTERED INDEX [IX_ProductLayer_productId] ON [ProductLayer]([productId] ASC);

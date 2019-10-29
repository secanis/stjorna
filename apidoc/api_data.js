define({ "api": [
  {
    "type": "get",
    "url": "/api/v1/categories/:id",
    "title": "Get Category",
    "name": "GetCategory",
    "group": "Category",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.0.0",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>unique Category ID.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "_id",
            "description": "<p>Category unique ID</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Category name</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "description",
            "description": "<p>Category description (larger text)</p>"
          },
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "active",
            "description": "<p>Is the Category active over the remote api.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "image",
            "description": "<p>Base64 image string, normally empty.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "imageUrl",
            "description": "<p>Image url, when an image is uploaded.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "created",
            "description": "<p>Timestamp when the item was created.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "createdUser",
            "description": "<p>UserID which user has created the item.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "updated",
            "description": "<p>Timestamp when the item was updated.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "updatedUser",
            "description": "<p>UserID which user has updatged the item.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_categories.js",
    "groupTitle": "Category"
  },
  {
    "type": "get",
    "url": "/api/v1/categories",
    "title": "Get Category List",
    "name": "GetCategoryList",
    "group": "Category",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.0.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object[Category]",
            "optional": false,
            "field": "Category",
            "description": "<p>Returns a list of categories.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_categories.js",
    "groupTitle": "Category"
  },
  {
    "type": "get",
    "url": "/api/v1/categories/:id/products",
    "title": "Get Products by Category",
    "name": "GetProductsByCategory",
    "group": "Category",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.0.0",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Category ID.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object[Product]",
            "optional": false,
            "field": "Product",
            "description": "<p>Returns a list of products.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_categories.js",
    "groupTitle": "Category"
  },
  {
    "type": "get",
    "url": "/api/v1/categories/:id/services",
    "title": "Get Services by Category",
    "name": "GetServicesByCategory",
    "group": "Category",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.1.0",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Category ID.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object[Service]",
            "optional": false,
            "field": "Service",
            "description": "<p>Returns a list of services.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_categories.js",
    "groupTitle": "Category"
  },
  {
    "type": "get",
    "url": "/api/data/uploads/:userid/:additionalPath?/:image",
    "title": "Get Image",
    "name": "GetImage",
    "group": "Data",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.0.0",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "userid",
            "description": "<p>users unique ID.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "additionalPath",
            "description": "<p>additonal path to a binary file</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "image",
            "description": "<p>image file name to load</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Data",
            "optional": false,
            "field": "Data",
            "description": "<p>Returns an image (jpeg)</p>"
          }
        ]
      }
    },
    "filename": "api/routes_data.js",
    "groupTitle": "Data"
  },
  {
    "type": "get",
    "url": "/api/data/uploads/:userid/:additionalPath?",
    "title": "Get Image List",
    "name": "GetListImages",
    "group": "Data",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.0.0",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "userid",
            "description": "<p>users unique ID.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "additionalPath",
            "description": "<p>additonal path to a binary file</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String[]",
            "optional": false,
            "field": "Data",
            "description": "<p>Returns a list of uploaded data (normally an images).</p>"
          }
        ]
      }
    },
    "filename": "api/routes_data.js",
    "groupTitle": "Data"
  },
  {
    "type": "get",
    "url": "/api/v1/products/:id",
    "title": "Get Product",
    "name": "GetProduct",
    "group": "Product",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.0.0",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>unique Product ID.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "Product",
            "description": "<p>Returns a specific Product by ID.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "_id",
            "description": "<p>Product unique ID</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Product name</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "description",
            "description": "<p>Product description (larger text)</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "category",
            "description": "<p>Category unique ID</p>"
          },
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "active",
            "description": "<p>Is the Product active over the remote api.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "image",
            "description": "<p>Base64 image string, normally empty.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "imageUrl",
            "description": "<p>Image url, when an image is uploaded.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "created",
            "description": "<p>Timestamp when the item was created.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "createdUser",
            "description": "<p>UserID which user has created the item.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "updated",
            "description": "<p>Timestamp when the item was updated.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "updatedUser",
            "description": "<p>UserID which user has updatged the item.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_products.js",
    "groupTitle": "Product"
  },
  {
    "type": "get",
    "url": "/api/v1/products",
    "title": "Get Product List",
    "name": "GetProductsList",
    "group": "Product",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.0.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object[Product]",
            "optional": false,
            "field": "Product",
            "description": "<p>Returns a list of products.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_products.js",
    "groupTitle": "Product"
  },
  {
    "type": "get",
    "url": "/api/v1/services/:id",
    "title": "Get service",
    "name": "GetService",
    "group": "Service",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.1.0",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>unique Service ID.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "Service",
            "description": "<p>Returns a specific service by ID.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "_id",
            "description": "<p>service unique ID</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>Service name</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "description",
            "description": "<p>Service description (larger text)</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "category",
            "description": "<p>Category unique ID</p>"
          },
          {
            "group": "Success 200",
            "type": "Boolean",
            "optional": false,
            "field": "active",
            "description": "<p>Is the Service active over the remote api.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "image",
            "description": "<p>Base64 image string, normally empty.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "imageUrl",
            "description": "<p>Image url, when an image is uploaded.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "created",
            "description": "<p>Timestamp when the item was created.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "createdUser",
            "description": "<p>UserID which user has created the item.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "updated",
            "description": "<p>Timestamp when the item was updated.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "updatedUser",
            "description": "<p>UserID which user has updatged the item.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_services.js",
    "groupTitle": "Service"
  },
  {
    "type": "get",
    "url": "/api/v1/services",
    "title": "Get Service List",
    "name": "GetServicesList",
    "group": "Service",
    "permission": [
      {
        "name": "token/apikey"
      }
    ],
    "version": "1.1.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object[Service]",
            "optional": false,
            "field": "Service",
            "description": "<p>Returns a list of services.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_services.js",
    "groupTitle": "Service"
  }
] });

define({ "api": [
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "put",
    "url": "/api/v1/categories",
    "title": "Add Category",
    "name": "AddCategory",
    "group": "Category",
    "permission": [
      {
        "name": "loggedin"
      }
    ],
    "version": "1.0.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "Category",
            "description": "<p>Return the added category.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_categories.js",
    "groupTitle": "Category"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "delete",
    "url": "/api/v1/categories/:id",
    "title": "Delete Category",
    "name": "DeleteCategory",
    "group": "Category",
    "permission": [
      {
        "name": "loggedin"
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
            "description": "<p>unique category ID.</p>"
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
            "field": "Message",
            "description": "<p>Returns the status of the deleted category.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_categories.js",
    "groupTitle": "Category"
  },
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
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "post",
    "url": "/api/v1/categories/:id",
    "title": "Update Category",
    "name": "UpdateCategory",
    "group": "Category",
    "permission": [
      {
        "name": "loggedin"
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
            "description": "<p>unique category ID.</p>"
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
            "field": "Category",
            "description": "<p>Returns the updated category by ID.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_categories.js",
    "groupTitle": "Category"
  },
  {
    "type": "get",
    "url": "/api/data/uploads/:userid/:additionalPath?/:image?size=:size?",
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
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "size",
            "description": "<p>Which size of image you want to get (no set = original, thumbnail)</p>"
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
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "get",
    "url": "/api/v1/info/config",
    "title": "Get NodeJS ENV Config",
    "name": "GetNodeServerEnv",
    "group": "Info",
    "permission": [
      {
        "name": "loggedin"
      }
    ],
    "version": "1.0.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String[]",
            "optional": false,
            "field": "environment",
            "description": "<p>NodeJS environment configuration (&quot;STJORNA_&quot; variables)</p>"
          }
        ]
      }
    },
    "filename": "api/routes_info.js",
    "groupTitle": "Info"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "get",
    "url": "/api/v1/info/server",
    "title": "Get Host Information",
    "name": "GetServerInfo",
    "group": "Info",
    "permission": [
      {
        "name": "loggedin"
      }
    ],
    "version": "1.0.1",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "hostname",
            "description": "<p>Hostname</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "api_port",
            "description": "<p>Node port</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "os",
            "description": "<p>Host operating system</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "arch",
            "description": "<p>Host operating system architecture</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "mem_total",
            "description": "<p>Host total installed memory</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "mem_free",
            "description": "<p>Host total free memory</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "cpu",
            "description": "<p>Host type of cpu</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "loadavg",
            "description": "<p>Host avarage system cpu load</p>"
          }
        ]
      }
    },
    "filename": "api/routes_info.js",
    "groupTitle": "Info"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "put",
    "url": "/api/v1/products",
    "title": "Add Product",
    "name": "AddProducts",
    "group": "Product",
    "permission": [
      {
        "name": "loggedin"
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
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "delete",
    "url": "/api/v1/products/:id",
    "title": "Delete Product",
    "name": "DeleteProduct",
    "group": "Product",
    "permission": [
      {
        "name": "loggedin"
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
            "field": "Message",
            "description": "<p>Returns the status of the deleted Product.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_products.js",
    "groupTitle": "Product"
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
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "post",
    "url": "/api/v1/products/:id",
    "title": "Update Product",
    "name": "UpdateProduct",
    "group": "Product",
    "permission": [
      {
        "name": "loggedin"
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
            "description": "<p>Returns the updated Product by ID.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_products.js",
    "groupTitle": "Product"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "put",
    "url": "/api/v1/services",
    "title": "Add Service",
    "name": "AddServices",
    "group": "Service",
    "permission": [
      {
        "name": "loggedin"
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
            "description": "<p>Returns the created service.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_services.js",
    "groupTitle": "Service"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "delete",
    "url": "/api/v1/services/:id",
    "title": "Delete Service",
    "name": "DeleteService",
    "group": "Service",
    "permission": [
      {
        "name": "loggedin"
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
            "field": "Message",
            "description": "<p>Returns the status of the deleted Service.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_services.js",
    "groupTitle": "Service"
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
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "post",
    "url": "/api/v1/services/:id",
    "title": "Update Service",
    "name": "UpdateService",
    "group": "Service",
    "permission": [
      {
        "name": "loggedin"
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
            "description": "<p>Returns the updated Service by ID.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_services.js",
    "groupTitle": "Service"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "get",
    "url": "/api/v1/export/:filetype",
    "title": "Export Data",
    "name": "ExportData",
    "group": "Settings",
    "permission": [
      {
        "name": "loggedin"
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
            "field": "filetype",
            "description": "<p>Filetype of your export (json | excel)</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "file",
            "description": "<p>Returns the export as file download</p>"
          }
        ]
      }
    },
    "filename": "api/routes_settings.js",
    "groupTitle": "Settings"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "get",
    "url": "/api/v1/settings",
    "title": "Get Settings",
    "name": "GetSettings",
    "group": "Settings",
    "permission": [
      {
        "name": "loggedin"
      }
    ],
    "version": "1.2.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "password_secret",
            "description": "<p>Returns Settings object</p>"
          },
          {
            "group": "Success 200",
            "type": "boolean",
            "optional": false,
            "field": "allow_remote_access",
            "description": "<p>Returns Settings object</p>"
          },
          {
            "group": "Success 200",
            "type": "object",
            "optional": false,
            "field": "image",
            "description": "<p>Returns Image Settings object</p>"
          },
          {
            "group": "Success 200",
            "type": "number",
            "optional": false,
            "field": "image.width",
            "description": "<p>Width for saved image</p>"
          },
          {
            "group": "Success 200",
            "type": "number",
            "optional": false,
            "field": "image.height",
            "description": "<p>Height for saved image</p>"
          },
          {
            "group": "Success 200",
            "type": "number",
            "optional": false,
            "field": "image.quality",
            "description": "<p>Quality for saved image</p>"
          }
        ]
      }
    },
    "filename": "api/routes_settings.js",
    "groupTitle": "Settings"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "post",
    "url": "/api/v1/settings",
    "title": "Save Settings",
    "name": "SaveSettings",
    "group": "Settings",
    "permission": [
      {
        "name": "loggedin"
      }
    ],
    "version": "1.0.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "message",
            "description": "<p>Returns a message to the save process</p>"
          },
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "status",
            "description": "<p>Returns the status of the save process</p>"
          }
        ]
      }
    },
    "filename": "api/routes_settings.js",
    "groupTitle": "Settings"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "get",
    "url": "/api/v1/setup",
    "title": "Get Setup Status with Login",
    "name": "GetSetupWithLogin",
    "group": "Setup",
    "permission": [
      {
        "name": "loggedin"
      }
    ],
    "version": "1.2.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "password_secret",
            "description": "<p>Returns Settings object</p>"
          },
          {
            "group": "Success 200",
            "type": "boolean",
            "optional": false,
            "field": "allow_remote_access",
            "description": "<p>Returns Settings object</p>"
          },
          {
            "group": "Success 200",
            "type": "object",
            "optional": false,
            "field": "image",
            "description": "<p>Returns Image Settings object</p>"
          },
          {
            "group": "Success 200",
            "type": "number",
            "optional": false,
            "field": "image.width",
            "description": "<p>Width for saved image</p>"
          },
          {
            "group": "Success 200",
            "type": "number",
            "optional": false,
            "field": "image.height",
            "description": "<p>Height for saved image</p>"
          },
          {
            "group": "Success 200",
            "type": "number",
            "optional": false,
            "field": "image.quality",
            "description": "<p>Quality for saved image</p>"
          }
        ]
      }
    },
    "filename": "api/routes_settings.js",
    "groupTitle": "Setup"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "option",
    "url": "/api/v1/setup",
    "title": "Get Setup Status without Login",
    "name": "GetSetupWithoutLogin",
    "group": "Setup",
    "permission": [
      {
        "name": "none"
      }
    ],
    "version": "1.0.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "message",
            "description": "<p>Returns a message string</p>"
          },
          {
            "group": "Success 200",
            "type": "boolean",
            "optional": false,
            "field": "installed",
            "description": "<p>Returns the installation</p>"
          }
        ]
      }
    },
    "filename": "api/routes_settings.js",
    "groupTitle": "Setup"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "post",
    "url": "/api/v1/setup",
    "title": "Create Setup",
    "name": "SaveSetup",
    "group": "Setup",
    "permission": [
      {
        "name": "none"
      }
    ],
    "version": "1.0.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "message",
            "description": "<p>Returns a message to the save process</p>"
          },
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "status",
            "description": "<p>Returns the status of the save process</p>"
          }
        ]
      }
    },
    "filename": "api/routes_settings.js",
    "groupTitle": "Setup"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "get",
    "url": "/api/v1/state/cron",
    "title": "Get Cron State",
    "name": "GetCronState",
    "group": "State",
    "permission": [
      {
        "name": "loggedin"
      }
    ],
    "version": "1.3.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "date",
            "optional": false,
            "field": "timestamp",
            "description": "<p>of the last entry/modification</p>"
          },
          {
            "group": "Success 200",
            "type": "object",
            "optional": false,
            "field": "cronjobs",
            "description": "<p>The cronjob entry item</p>"
          },
          {
            "group": "Success 200",
            "type": "string",
            "optional": false,
            "field": "cronjobs.name",
            "description": "<p>Cronjob name</p>"
          },
          {
            "group": "Success 200",
            "type": "boolean",
            "optional": false,
            "field": "cronjobs.ok",
            "description": "<p>Is the cronjob working as expected</p>"
          },
          {
            "group": "Success 200",
            "type": "date",
            "optional": false,
            "field": "cronjobs.last",
            "description": "<p>Last execution of the cronjob</p>"
          },
          {
            "group": "Success 200",
            "type": "date",
            "optional": false,
            "field": "cronjobs.next",
            "description": "<p>Next execution of the cronjob</p>"
          },
          {
            "group": "Success 200",
            "type": "date",
            "optional": false,
            "field": "cronjobs.timestamp",
            "description": "<p>Updated the state entry</p>"
          }
        ]
      }
    },
    "filename": "api/routes_settings.js",
    "groupTitle": "State"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "put",
    "url": "/api/v1/users/",
    "title": "Add User",
    "name": "AddUser",
    "group": "User",
    "permission": [
      {
        "name": "loggedin"
      }
    ],
    "version": "1.0.0",
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "User",
            "description": "<p>Returns user object.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_user.js",
    "groupTitle": "User"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "post",
    "url": "/api/v1/users/apikey/:id",
    "title": "Generate APIKEY by UserID",
    "name": "GenerateApiKey",
    "group": "User",
    "permission": [
      {
        "name": "loggedin"
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
            "description": "<p>users unique ID.</p>"
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
            "field": "Apikey",
            "description": "<p>Returns a status ok message object.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_user.js",
    "groupTitle": "User"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "get",
    "url": "/api/v1/users/apikey/:id",
    "title": "Get APIKEY by UserID",
    "name": "GetApiKey",
    "group": "User",
    "permission": [
      {
        "name": "loggedin"
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
            "description": "<p>users unique ID.</p>"
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
            "field": "Apikey",
            "description": "<p>Returns apikey object.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_user.js",
    "groupTitle": "User"
  },
  {
    "0": "p",
    "1": "r",
    "2": "i",
    "3": "v",
    "4": "a",
    "5": "t",
    "6": "e",
    "type": "post",
    "url": "/api/v1/users/:id",
    "title": "Update User",
    "name": "UpdateUser",
    "group": "User",
    "permission": [
      {
        "name": "loggedin"
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
            "description": "<p>users unique ID.</p>"
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
            "field": "User",
            "description": "<p>Returns updated user object.</p>"
          }
        ]
      }
    },
    "filename": "api/routes_user.js",
    "groupTitle": "User"
  }
] });

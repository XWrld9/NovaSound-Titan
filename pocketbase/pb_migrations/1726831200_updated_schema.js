/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  // Ajouter les champs manquants à la table users
  const collection = new Collection({
    id: "users",
    name: "users",
    type: "auth",
    schema: [
      {
        name: "id",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: null,
          pattern: ""
        }
      },
      {
        name: "username",
        type: "text",
        required: true,
        presentable: false,
        unique: true,
        options: {
          min: 3,
          max: 50,
          pattern: "^[a-zA-Z0-9_]+$"
        }
      },
      {
        name: "email",
        type: "email",
        required: true,
        presentable: false,
        unique: true,
        options: {}
      },
      {
        name: "verified",
        type: "bool",
        required: false,
        presentable: false,
        unique: false,
        options: {}
      },
      {
        name: "avatar",
        type: "file",
        required: false,
        presentable: false,
        unique: false,
        options: {
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ["image/jpeg", "image/png", "image/webp"]
        }
      },
      {
        name: "bio",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: 500,
          pattern: ""
        }
      },
      {
        name: "followers",
        type: "number",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: 0,
          max: null
        }
      },
      {
        name: "following",
        type: "number",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: 0,
          max: null
        }
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_users_email ON users (email)",
      "CREATE UNIQUE INDEX idx_users_username ON users (username)"
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    options: {}
  });

  // Créer la table des likes
  const likesCollection = new Collection({
    id: "likes",
    name: "likes",
    type: "base",
    schema: [
      {
        name: "id",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: null,
          pattern: ""
        }
      },
      {
        name: "user",
        type: "relation",
        required: true,
        presentable: false,
        unique: false,
        options: {
          collectionId: "users",
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1
        }
      },
      {
        name: "song",
        type: "relation",
        required: true,
        presentable: false,
        unique: false,
        options: {
          collectionId: "songs",
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1
        }
      },
      {
        name: "created",
        type: "date",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: "",
          max: ""
        }
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_likes_user_song ON likes (user, song)"
    ],
    listRule: null,
    viewRule: null,
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    options: {}
  });

  // Créer la table des follows
  const followsCollection = new Collection({
    id: "follows",
    name: "follows",
    type: "base",
    schema: [
      {
        name: "id",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: null,
          pattern: ""
        }
      },
      {
        name: "follower",
        type: "relation",
        required: true,
        presentable: false,
        unique: false,
        options: {
          collectionId: "users",
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1
        }
      },
      {
        name: "following",
        type: "relation",
        required: true,
        presentable: false,
        unique: false,
        options: {
          collectionId: "users",
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1
        }
      },
      {
        name: "created",
        type: "date",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: "",
          max: ""
        }
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_follows_follower_following ON follows (follower, following)"
    ],
    listRule: null,
    viewRule: null,
    createRule: "@request.auth.id != '' && follower = @request.auth.id",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && follower = @request.auth.id",
    options: {}
  });

  return [collection, likesCollection, followsCollection];
}, (db) => {
  // Rollback
});

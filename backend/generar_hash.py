from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Definimos una contraseña corta exclusivamente para esta prueba
contrasena_nueva = "admin123" 
hash_generado = pwd_context.hash(contrasena_nueva)

print("========================================")
print(f"Tu contraseña en texto plano es: {contrasena_nueva}")
print(f"El HASH que debes copiar es: \n{hash_generado}")
print("========================================")
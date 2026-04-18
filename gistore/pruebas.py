#operaciones Matematicas
from os import system
system("clear") #linux
#system("cls") #windows

#Sumas
#la suma al igual que la concatenación se usa el simbolo +
#nota; SOlo se suman numero a  número, si se suman numero a texto se concatenan
print(2+3) #5
print("Hola"+"Mundo") #HolaMundo
print("Hola"+str(5)) #Hola5
print("Hola"+'5') #Hola5

#Resta
#la resta se usa el simbolo - 
#nota; solo se restan numero a numero, si se resta numero a texto se produce un error
#\n reperersenta un salto de linea, es decir, lo que esta despues de \n se muestra en una nueva linea
print("\nResta",5-2) #3
#print("Hola"-"Mundo") #error
#print("Hola"-str(5)) #error
#print('5'-'5') #error


#Multiplicacion
#la multiplicacion se usa el simbolo *
#nota; solo se multiplican numero a numero, si se multiplica numero a texto se produce un error, 
# pero si se multiplica texto a numero se repite el texto el numero de veces indicado
print("\nMultiplicacion",5*2) #10
#print("Hola"*"Mundo") #error
#print("Hola"*str(5)) #error
print("Hola\n"*3) #HolaHolaHola  

#Division
#la division se usa el simbolo /
#nota; solo se dividen numero a numero, si se divide numero a texto se produce un error
# un / devuelve un numero decimal, si se quiere una division entera se usa el simbolo //

print("\nDivision",10/3) #3.33333333
print("Division entera",3.5//2.6) #2
#print("Hola"/"Mundo") #error
#print("Hola"/str(5)) #error


#Potencia
#la potencia se usa el simbolo **
#nota; solo se pueden potenciar numero a numero, si se potencia numero a texto se produce un error
print("\nPotencia",2**3) #8
#print("Hola"**"Mundo") #error
#print("Hola"**str(5)) #error

#Modulo
#el modulo se usa el simbolo %
#nota; solo se pueden calcular el modulo de numero a numero, si se calcula el modulo
#sirve para obtener el residuo de una division, es decir, 
# el numero que sobra despues de hacer la division
print("\nModulo",5%2) #1
print("Modulo",10%3) #1
if( 15%5 == 0):
    print("15 es divisible entre 5")
else:    print("15 no es divisible entre 5")

#Operadores de asignacion
#los operadores de asignacion se usan para asignar un valor a una variable,
# el operador de asignacion basico es el simbolo =, pero existen otros operadores de
#asignacion que combinan una operacion matematica con la asignacion, como por ejemplo:
#+=, -=, *=, /=, **=, //=, %=
#nota; el operador de asignacion basico = asigna un valor a una variable,
# mientras que los operadores de asignacion combinados realizan la operacion matematica y luego asignan el resultado a la variable, por ejemplo:
x = 5 #asigna el valor 5 a la variable x
print("\nValor de x",x) #5
x += 3 #equivalente a x = x + 3, asigna el resultado de x + 3 a x
print("Valor de x despues de x += 3",x) #8
x -= 2 #equivalente a x = x - 2, asigna el resultado de x - 2 a x
print("Valor de x despues de x -= 2",x) #6
x *= 4 #equivalente a x = x * 4, asigna el resultado de x * 4 a x
print("Valor de x despues de x *= 4",x) #24
x /= 6 #equivalente a x = x / 6, asigna el resultado de x / 6 a x
print("Valor de x despues de x /= 6",x) #4.0
x **= 2 #equivalente a x = x ** 2, asigna el resultado de x ** 2 a x
print("Valor de x despues de x **= 2",x) #16.0
x //= 3 #equivalente a x = x // 3, asigna el resultado de x // 3 a x
print("Valor de x despues de x //= 3",x) #5.0
x %= 2 #equivalente a x = x % 2, asigna el resultado de x % 2 a x
print("Valor de x despues de x %= 2",x) #1.0

#Operadores de comparacion
#los operadores de comparacion se usan para comparar dos valores, el resultado de la comparacion es un valor booleano (True o False), 
# los operadores de comparacion son:
#==, !=, >, <, >=, <=
#nota; el operador de comparacion == se usa para comparar si dos valores son iguales, 
# el operador != se usa para comparar si dos valores son diferentes, el operador > se usa para 
# comparar si un valor es mayor que otro, el operador < se usa para comparar si un valor es menor que otro, el operador >= se usa para comparar si un valor es mayor o igual que otro,
# el operador <= se usa para comparar si un valor es menor o igual que otro, por ejemplo:
print("\nComparacion",5 == 5) #True  Comparación
print("Comparacion",5 != 3) #True   DIferente de 
print("Comparacion",5 > 3) #True Mayor que 
print("Comparacion",5 < 3) #False Menor que
print("Comparacion",5 >= 5) #True Mayor o igual que
print("Comparacion",5 <= 3) #False Menor o igual que


#Operadores logicos
#los operadores logicos se usan para combinar varias condiciones, el resultado de la operacion logica es un valor booleano (True o False), 
# los operadores logicos son:
#and, or, not
#nota; el operador logico and se usa para combinar dos condiciones, el resultado de la operacion 
# logica and es True si ambas condiciones son True, el operador logico
#or se usa para combinar dos condiciones, el resultado de la operacion logica or es True si 
# al menos una de las condiciones es True, el operador logico not se usa para negar una condicion,
# el resultado de la operacion logica not es True si la condicion es False, por ejemplo:

#and es un operador logico que se usa para combinar dos condiciones, el resultado de la operacion
# logica and es True si ambas condiciones son True, por ejemplo:
print("\nLogico",True and True) #True
if( 5 > 3 and 2 < 4):
    print("La condicion es verdadera") 
print("Logico",True and False) #False
print("Logico",False and False) #False

#or es un operador logico que se usa para combinar dos condiciones, el resultado de la operacion
# logica or es True si al menos una de las condiciones es True, por ejemplo:
print("Logico",True or True) #True
print("Logico",True or False) #True
print("Logico",False or False) #False

#not es un operador logico que se usa para negar una condicion, el resultado de la operacion 
# logica not es True si la condicion es False, y False si la condicion es True, por ejemplo: 
print("Logico",not True) #False
print("Logico",not False) #True
if( not 2 > 3):
    print("La condicion es verdadera")
else:    print("La condicion es falsa")


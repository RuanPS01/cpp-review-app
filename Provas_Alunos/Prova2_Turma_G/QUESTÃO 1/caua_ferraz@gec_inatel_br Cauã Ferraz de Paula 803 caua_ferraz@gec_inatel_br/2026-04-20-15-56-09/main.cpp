#include <iomanip>
#include <iostream>
#include <cstring>
#include <cmath>

using namespace std;

int main()
{
    //contadores
    int pares;
    int impares;
    int positivos;
    int negativos;
    
    int N = 0; //quantidade de numeros a serem inseridos
    int Numeros[100]; //lista com quantidades de numeros a serem inseridos
    
    cin >> N; //insere a quantidade
    
    for(int i = 0; i < N; i++)
    {
        cin >> Numeros[i];
        
        if(Numeros[i] % 2 == 0)
        {
            pares = pares +1;
        }
        else
        {
            impares = impares + 1;
        }
        
        if(Numeros[i] > 0)
        {
            positivos = positivos + 1;
        }
        else if(Numeros[i] < 0)
        {
            negativos = negativos + 1;
        }
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos"<< endl;
    cout << negativos << " numeros negativos"<< endl;
    
    return 0;
}
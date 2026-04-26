#include <iostream>
using namespace std;

int main()
{
    int quant;
    int num;
    int pares = 0, impares = 0, positivos = 0,  negativos = 0;
    
    cin >> quant;
    
    for(int i = 0; i < quant; i++)
    {
        cin >> num;
        if(num == 0)
        {
            pares++;
        }
        else if(num % 2 == 0)
        {
            if(num > 0)
            {
                positivos++;
            }
            else
            {
                negativos++;
            }
            pares++;
        }
        else
        {
            if(num > 0)
            {
                positivos++;
            }
            else
            {
                negativos++;
            }
            impares++;
        }
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos" << endl;
    cout << negativos << " numeros negativos" << endl;
    
    return  0;
}
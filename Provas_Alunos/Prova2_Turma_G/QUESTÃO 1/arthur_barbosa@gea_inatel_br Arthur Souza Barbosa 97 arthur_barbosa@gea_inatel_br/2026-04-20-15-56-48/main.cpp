#include <iostream>
using namespace std;


int main()
{
    int n,num, par=0,impar=0,positivo=0,negativo=0;
    cin >> n;
    for(int i=0; i<n; i++)
    {
        cin >> num;
        
        if(num%2==0 & num>0)
        {
            par++;
            positivo++;
        }
        else if(num==0)
        {
            par++;
        }
        else if(num%2==0 & num<0)
        {
            par++;
            negativo++;
        }
        else if(num%2!=0 & num>=0)
        {
            impar++;
            positivo++;
        }
        else if(num%2!=0 & num<0)
        {
            impar++;
            negativo++;
        }
        
    }
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;
    cout << positivo << " numeros positivos" << endl;
    cout << negativo << " numeros negativos" << endl;
    
    return 0;
}
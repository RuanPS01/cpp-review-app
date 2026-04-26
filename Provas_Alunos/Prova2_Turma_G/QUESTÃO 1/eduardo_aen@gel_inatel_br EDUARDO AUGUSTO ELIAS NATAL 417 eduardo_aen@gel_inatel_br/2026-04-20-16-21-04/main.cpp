#include <iostream>

using namespace std;

int main (){
    
    int n, x;
    int par = 0;
    int impar = 0;
    int pos = 0;
    int neg = 0;
    
    cin >> n;
    
    for (int i = 0; i < n; i++)
    {
        cin >> x;
        
        if ( x == 0)
        {
            par = par + 1;
        }
        
        else if (x > 0)
        {
            pos = pos + 1;
            
            if (x % 2 == 0)
            {
                par = par + 1;
            }
            else
            {
                impar = impar + 1;
            }
        }
        else if (x < 0)
        {
            neg = neg + 1;
            
            if (x % 2 == 0)
            {
                par = par + 1;
            }
            else 
            {
                impar = impar + 1;
            }
        }
    }
    
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;
    cout << pos << " numeros positivos" << endl;
    cout << neg << " numeros negativos" << endl;
    
    
    return 0;
}
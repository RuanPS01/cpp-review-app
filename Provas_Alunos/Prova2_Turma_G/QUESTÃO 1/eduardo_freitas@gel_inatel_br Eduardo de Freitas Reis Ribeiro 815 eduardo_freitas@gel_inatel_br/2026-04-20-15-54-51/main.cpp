#include <iostream>
using namespace std;

int main()
{
    int n, par = 0, impar = 0, posi = 0, neg = 0;
    
    cin >> n;
    
    int v[100];
    
    for(int i = 0; i < n; i++)
    {
        cin >> v[i];
        
        if(v[i] % 2 == 0)
        {
            par++;
        }else if( v[i] % 2 != 0)
        {
            impar++;
        }
    }
    
    for(int i = 0; i < n; i++)
    {
        if(v[i] > 0)
        {
            posi++;
        }else if(v[i] < 0)
        {
            neg++;
        }
        
        
       
    }
    
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;
    cout << posi << " numeros positivos" << endl;
    cout << neg << " numeros negativos" << endl;
    
    
    
    
    
    return 0;
}
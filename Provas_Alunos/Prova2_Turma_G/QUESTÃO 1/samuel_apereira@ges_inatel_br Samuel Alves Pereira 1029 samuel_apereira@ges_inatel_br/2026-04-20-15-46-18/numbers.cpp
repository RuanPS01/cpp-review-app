#include <iostream>
using namespace std;


int main()
{
    int n;
    cin >> n;
    
    int even = 0;
    int odd = 0;
    int pos = 0;
    int neg = 0;
    
    for (int i = 0; i < n; i++)
    {
        int a;
        cin >> a;
        
        if (a % 2 == 0)
            even++;
        else
            odd++;
            
        if (a > 0)
            pos++;
        else if (a < 0)
            neg++;
    }
    
    cout << even << " numeros pares" << endl;
    cout << odd << " numeros impares" << endl;
    cout << pos << " numeros positivos" << endl;
    cout << neg << " numeros negativos" << endl;
    
    return 0;
}
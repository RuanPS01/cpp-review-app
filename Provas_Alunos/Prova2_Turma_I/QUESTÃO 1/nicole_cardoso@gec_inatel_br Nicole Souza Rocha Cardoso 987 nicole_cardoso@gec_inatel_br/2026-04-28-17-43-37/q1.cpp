#include <iostream>
using namespace std;

int main()
{
    int n, valores[100], cont = 0;
    cin >> n;
    
    for(int i = 0; i < n; i++)
    {
        cin >> valores[i];
        
        if(valores[i] % 3 == 0)
            cont++;
    }
    
    cout << cont << endl;
    
    
    return 0;
}